//! A repeatable torrent measurement (#352): `docs/research/2026-11-06-torrent-performance.md` has
//! the method and the results. Run by hand, never in CI, because it uses public swarms.
//!
//! ```text
//! cargo run --release --no-default-features -p velocity-torrent --example torrent_baseline -- \
//!     <helper program> <.torrent file or magnet link> <work folder> <runs>
//! ```
//!
//! Each run starts a new helper with the app's default settings, in a new folder, so no peers or
//! DHT nodes are remembered. It prints one line of JSON and deletes what it downloaded. Only the
//! listening port differs from the default, so it can't clash with a running app.
//!
//! Each run also saves every half-second sample to `<work folder>/run-<n>.tsv`, and its line names
//! the slowest 30 seconds: when they began, how far the download was, and the fewest peers (#386).

use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use velocity_core::domain::DownloadStatus;
use velocity_core::seeding::SeedPolicy;
use velocity_core::torrent_engine::{TorrentEngine, TorrentSettings, TorrentSource, TorrentSpec};
use velocity_torrent::supervisor::{SupervisedTorrentEngine, SupervisorOptions};

const LISTEN_PORT: u16 = 6891;
const SAMPLE_EVERY: Duration = Duration::from_millis(500);
const RUN_LIMIT: Duration = Duration::from_secs(45 * 60);
/// The peak speed is the best this long, so one burst isn't called a speed.
const PEAK_WINDOW_SECS: f64 = 5.0;
const MIB: f64 = 1_048_576.0;
/// The slow stretch is the slowest this long: long enough that one stalled request isn't it.
const STRETCH_SECS: f64 = 30.0;

/// One look at the torrent.
#[derive(Debug, Clone, Copy)]
struct Sample {
    secs: f64,
    bytes: u64,
    peers: u32,
    seeds: u32,
    metadata: bool,
}

/// What one run measured. A time is `None` when it never happened.
#[derive(Debug, Clone, PartialEq)]
struct Summary {
    metadata_secs: Option<f64>,
    first_peer_secs: Option<f64>,
    first_byte_secs: Option<f64>,
    last_secs: f64,
    bytes: u64,
    mean_mib_s: Option<f64>,
    peak_mib_s: Option<f64>,
    max_peers: u32,
    max_seeds: u32,
}

fn summarise(samples: &[Sample]) -> Summary {
    let first = |found: &dyn Fn(&Sample) -> bool| samples.iter().find(|s| found(s)).copied();
    let first_byte = first(&|s| s.bytes > 0);
    let last = samples.last().copied();
    let rate = |from: &Sample, to: &Sample| {
        (to.bytes.saturating_sub(from.bytes)) as f64 / MIB / (to.secs - from.secs)
    };
    let mean = first_byte
        .zip(last)
        .filter(|(from, to)| to.secs > from.secs)
        .map(|(from, to)| rate(&from, &to));
    let peak = samples
        .iter()
        .filter_map(|from| {
            let to = samples
                .iter()
                .find(|to| to.secs >= from.secs + PEAK_WINDOW_SECS)?;
            Some(rate(from, to))
        })
        .fold(None, |best: Option<f64>, r| {
            Some(best.map_or(r, |b| b.max(r)))
        })
        .filter(|r| *r > 0.0);
    Summary {
        metadata_secs: first(&|s| s.metadata).map(|s| s.secs),
        first_peer_secs: first(&|s| s.peers > 0).map(|s| s.secs),
        first_byte_secs: first_byte.map(|s| s.secs),
        last_secs: last.map_or(0.0, |s| s.secs),
        bytes: last.map_or(0, |s| s.bytes),
        mean_mib_s: mean,
        peak_mib_s: peak,
        max_peers: samples.iter().map(|s| s.peers).max().unwrap_or(0),
        max_seeds: samples.iter().map(|s| s.seeds).max().unwrap_or(0),
    }
}

/// The slow stretch #386 looks for.
#[derive(Debug, Clone, PartialEq)]
struct Stretch {
    from_secs: f64,
    mib_s: f64,
    /// The fewest peers seen during it.
    fewest_peers: u32,
    /// How much of the download was done when it started, from 0 to 1.
    share_done: f64,
}

/// The slowest `secs` of a run, from one sample to the first at least `secs` later; `None` for a
/// run shorter than that.
fn slowest_stretch(samples: &[Sample], secs: f64) -> Option<Stretch> {
    let total = samples.last()?.bytes.max(1) as f64;
    let mut slowest: Option<Stretch> = None;
    for (i, from) in samples.iter().enumerate() {
        let Some(j) = samples[i..]
            .iter()
            .position(|to| to.secs >= from.secs + secs)
        else {
            break;
        };
        let to = &samples[i + j];
        let mib_s = to.bytes.saturating_sub(from.bytes) as f64 / MIB / (to.secs - from.secs);
        if slowest.as_ref().is_none_or(|s| mib_s < s.mib_s) {
            slowest = Some(Stretch {
                from_secs: from.secs,
                mib_s,
                fewest_peers: samples[i..=i + j]
                    .iter()
                    .map(|s| s.peers)
                    .min()
                    .unwrap_or(0),
                share_done: from.bytes as f64 / total,
            });
        }
    }
    slowest
}

/// Every sample, one per line, for a spreadsheet or a chart (#386).
fn samples_tsv(samples: &[Sample]) -> String {
    let mut text = String::from("secs\tmib\tpeers\tseeds\n");
    for s in samples {
        text.push_str(&format!(
            "{:.1}\t{:.2}\t{}\t{}\n",
            s.secs,
            s.bytes as f64 / MIB,
            s.peers,
            s.seeds
        ));
    }
    text
}

/// Follows one torrent to its end, or to the limit; how it ended, and the samples.
fn run(helper: &Path, source: &str, folder: &Path) -> Result<(&'static str, Vec<Sample>), String> {
    let settings = TorrentSettings {
        listen_port: LISTEN_PORT,
        ..TorrentSettings::default()
    };
    let mut engine = SupervisedTorrentEngine::start(
        helper.to_path_buf(),
        SupervisorOptions::default(),
        settings,
    )
    .map_err(|e| format!("the helper didn't start: {e:?}"))?;
    let source = if source.starts_with("magnet:") {
        TorrentSource::Magnet {
            uri: source.to_owned(),
        }
    } else {
        TorrentSource::File {
            path: PathBuf::from(source),
        }
    };
    let started = Instant::now();
    let id = engine
        .add(TorrentSpec {
            source,
            directory: folder.to_path_buf(),
            trackers: Vec::new(),
            paused: false,
            choose_files: false,
            files: None,
            seeding: SeedPolicy::Never {},
            upload_limit: 0,
            download_limit: 0,
        })
        .map_err(|e| format!("the torrent wasn't added: {e:?}"))?;
    let mut samples = Vec::new();
    loop {
        std::thread::sleep(SAMPLE_EVERY);
        let all = engine
            .snapshot()
            .map_err(|e| format!("no snapshot: {e:?}"))?;
        let Some(t) = all.into_iter().find(|t| t.id == id) else {
            return Err("the torrent went away".to_owned());
        };
        samples.push(Sample {
            secs: started.elapsed().as_secs_f64(),
            bytes: t.progress.completed_bytes,
            peers: t.peers,
            seeds: t.seeds,
            metadata: t.progress.total_bytes.is_some(),
        });
        match t.status {
            DownloadStatus::Completed | DownloadStatus::Seeding => {
                return Ok(("complete", samples))
            }
            DownloadStatus::Failed => return Ok(("failed", samples)),
            _ if started.elapsed() > RUN_LIMIT => return Ok(("limit", samples)),
            _ => {}
        }
    }
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let [helper, source, work, runs] = args.as_slice() else {
        eprintln!("usage: torrent_baseline <helper program> <.torrent file or magnet link> <work folder> <runs>");
        std::process::exit(2);
    };
    let runs: u32 = runs.parse().expect("runs is a number");
    for n in 1..=runs {
        let folder = Path::new(work).join(format!("run-{n}"));
        std::fs::create_dir_all(&folder).expect("the work folder can be made");
        let folder = folder.canonicalize().expect("the work folder exists");
        let line = match run(Path::new(helper), source, &folder) {
            Ok((outcome, samples)) => {
                let s = summarise(&samples);
                let series = Path::new(work).join(format!("run-{n}.tsv"));
                if let Err(e) = std::fs::write(&series, samples_tsv(&samples)) {
                    eprintln!("run {n}: the samples weren't saved: {e}");
                }
                let slow = slowest_stretch(&samples, STRETCH_SECS);
                serde_json::json!({
                    "run": n, "outcome": outcome, "metadataSecs": s.metadata_secs, "firstPeerSecs": s.first_peer_secs,
                    "firstByteSecs": s.first_byte_secs, "endSecs": s.last_secs, "bytes": s.bytes, "meanMiBs": s.mean_mib_s,
                    "peakMiBs": s.peak_mib_s, "maxPeers": s.max_peers, "maxSeeds": s.max_seeds,
                    "slowest": slow.map(|x| serde_json::json!({
                        "fromSecs": x.from_secs, "MiBs": x.mib_s, "fewestPeers": x.fewest_peers, "shareDone": x.share_done,
                    })),
                    "samples": series.display().to_string(),
                })
            }
            Err(why) => serde_json::json!({ "run": n, "outcome": "error", "why": why }),
        };
        println!("{line}");
        // The helper has stopped with its engine; give Windows a moment to let go of the files.
        std::thread::sleep(Duration::from_secs(3));
        if let Err(e) = std::fs::remove_dir_all(&folder) {
            eprintln!("run {n}: the folder wasn't deleted: {e}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(secs: f64, bytes: u64, peers: u32) -> Sample {
        Sample {
            secs,
            bytes,
            peers,
            seeds: peers / 2,
            metadata: secs >= 1.0,
        }
    }

    #[test]
    fn times_each_first_and_the_mean_from_the_first_byte() {
        let samples = [
            at(0.0, 0, 0),
            at(1.0, 0, 0),
            at(2.0, 0, 4),
            at(4.0, 1_048_576, 6),
            at(14.0, 11_534_336, 2),
        ];
        let s = summarise(&samples);
        assert_eq!(s.metadata_secs, Some(1.0));
        assert_eq!(s.first_peer_secs, Some(2.0));
        assert_eq!(s.first_byte_secs, Some(4.0));
        assert_eq!(s.last_secs, 14.0);
        assert_eq!(s.bytes, 11_534_336);
        assert_eq!(s.mean_mib_s, Some(1.0));
        assert_eq!(s.max_peers, 6);
        assert_eq!(s.max_seeds, 3);
    }

    #[test]
    fn the_peak_is_the_best_five_seconds_not_one_burst() {
        let samples = [
            at(0.0, 0, 1),
            at(1.0, 52_428_800, 1),
            at(5.0, 52_428_800, 1),
            at(10.0, 73_400_320, 1),
        ];
        // 50 MiB in the first second, but at best 50 MiB over five seconds: 10 MiB/s.
        assert_eq!(summarise(&samples).peak_mib_s, Some(10.0));
    }

    #[test]
    fn says_so_when_nothing_ever_happened() {
        let s = summarise(&[
            Sample {
                secs: 0.0,
                bytes: 0,
                peers: 0,
                seeds: 0,
                metadata: false,
            },
            Sample {
                secs: 9.0,
                bytes: 0,
                peers: 0,
                seeds: 0,
                metadata: false,
            },
        ]);
        assert_eq!(
            (s.metadata_secs, s.first_peer_secs, s.first_byte_secs),
            (None, None, None)
        );
        assert_eq!((s.mean_mib_s, s.peak_mib_s), (None, None));
    }

    #[test]
    fn writes_every_sample_as_a_line() {
        let text = samples_tsv(&[at(0.0, 0, 0), at(1.5, 3_145_728, 4)]);
        assert_eq!(
            text,
            "secs\tmib\tpeers\tseeds\n0.0\t0.00\t0\t0\n1.5\t3.00\t4\t2\n"
        );
    }

    #[test]
    fn finds_the_slowest_stretch_and_who_was_there() {
        // 10 MiB/s, then 30 s at 1 MiB/s with 2 peers, then fast again.
        let mut samples = Vec::new();
        let mut bytes = 0;
        for i in 0..=80 {
            let secs = f64::from(i);
            let slow = (20..50).contains(&i);
            if i > 0 {
                bytes += if slow { 1_048_576 } else { 10_485_760 };
            }
            samples.push(at(secs, bytes, if slow { 2 } else { 40 }));
        }
        // From 19 s to 49 s every second brought 1 MiB; 190 of 530 MiB were done by then.
        let s = slowest_stretch(&samples, 30.0).unwrap();
        assert_eq!(s.from_secs, 19.0);
        assert_eq!(s.mib_s, 1.0);
        assert_eq!(s.fewest_peers, 2);
        assert_eq!(s.share_done, 190.0 / 530.0);
    }

    #[test]
    fn has_no_slowest_stretch_in_a_run_shorter_than_it() {
        assert_eq!(
            slowest_stretch(&[at(0.0, 0, 1), at(10.0, 5, 1)], 30.0),
            None
        );
    }
}
