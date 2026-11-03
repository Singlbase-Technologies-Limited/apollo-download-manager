//! The downloader over HTTP/2 (#47), against the local HTTP/2 server with prior knowledge (the
//! `test-h2c` feature; PO decision on #47): the probe's fixtures moved here from #41, the split's
//! stream reset moved from #42, and the multiplex policy. Real libcurl, real sockets, real files.

use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;

use velocity_core::domain::FailureClass;
use velocity_curl::{CurlLoop, Libcurl, LoopOptions};
use velocity_test_http::timeline::Timeline;
use velocity_test_http::{seeded_bytes, AnsweringLimit, Http2Options, Http2Server, RangeMode};
use velocity_transfer::adaptive::AdaptivePolicy;
use velocity_transfer::download::{
    download, download_with, Cadence, Control, DiskOptions, DownloadError, DownloadOptions, Mode,
};
use velocity_transfer::retry::RetryPolicy;
use velocity_transfer::scheduler::Sizes;

const MIB: usize = 1 << 20;

/// The ramp's tests measure speed, and the others download as fast as loopback allows: on CI's
/// Windows runner, run together, they slowed the 2 windows that judged one stream by 15% (main run
/// 41637850734, #281). Each test holds this for its whole run, so they run one at a time; a failed
/// one doesn't block the rest.
static SERIAL: Mutex<()> = Mutex::new(());

fn one_at_a_time() -> MutexGuard<'static, ()> {
    SERIAL
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

struct Dir(PathBuf);

impl Dir {
    fn new(name: &str) -> Self {
        let p = std::env::temp_dir().join(format!("v2-http2-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&p);
        std::fs::create_dir_all(&p).unwrap();
        Dir(p)
    }
    fn file(&self, name: &str) -> PathBuf {
        self.0.join(name)
    }
}

impl Drop for Dir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn h2c_loop() -> CurlLoop {
    CurlLoop::start(
        &Libcurl::start().expect("libcurl starts"),
        LoopOptions {
            http2_prior_knowledge: true,
            ..LoopOptions::default()
        },
    )
    .expect("the loop starts")
}

const FIXED: DownloadOptions = DownloadOptions {
    disk: DiskOptions::DEFAULT,
    connections: 4,
    probe_bytes: 64 * 1024,
    leases: Sizes::DEFAULT,
    checkpoints: Cadence::DEFAULT,
    retry: RetryPolicy::DEFAULT,
    adaptive: None,
};

fn serve(len: usize, options: Http2Options) -> (Http2Server, Vec<u8>) {
    let data = seeded_bytes(len, 71);
    (
        Http2Server::start(vec![("f.bin".into(), data.clone())], options),
        data,
    )
}

fn in_mode(range_mode: RangeMode) -> Http2Options {
    Http2Options {
        range_mode,
        ..Http2Options::default()
    }
}

#[test]
fn the_probe_classifies_answers_over_http2_as_over_http1() {
    let _serial = one_at_a_time();
    // #41's fixture rows over HTTP/2 (moved to #47): libcurl gives the engine the same status and
    // headers over either version, and the answers must be classified the same.
    let dir = Dir::new("probe");
    let lp = h2c_loop();

    let (s, data) = serve(1_000_000, Http2Options::default());
    let r = download(&lp, &s.url("f.bin"), &dir.file("honour"), FIXED).expect("ranges");
    assert!(std::fs::read(dir.file("honour")).unwrap() == data);
    // The probe, then segments opened 1, 2, 4 (PO decision on #247). On loopback the first ones
    // can finish before the last step opens, and the bytes left go to the streams free then, so how
    // many segments depends on timing, as over HTTP/1.1 (`tests/download.rs` in velocity-transfer,
    // #281): several at once, but never more than four.
    let ranges = s.counters().ranges;
    assert_eq!(r.mode, Mode::Ranges);
    assert!(
        r.fetches >= 5,
        "the probe, then at least four segments: {ranges:?}"
    );
    assert!(
        (2..=4).contains(&r.peak_requests),
        "{} requests open at once, for 4 connections: {ranges:?}",
        r.peak_requests
    );
    assert_eq!(s.counters().gets, u64::from(r.fetches));

    let (s, data) = serve(500_000, in_mode(RangeMode::Ignore));
    let r = download(&lp, &s.url("f.bin"), &dir.file("ignore"), FIXED).expect("one stream");
    assert!(std::fs::read(dir.file("ignore")).unwrap() == data);
    assert_eq!(
        (r.mode, r.fetches, s.counters().gets),
        (Mode::SingleStream, 1, 1)
    );

    let (s, _) = serve(500_000, in_mode(RangeMode::MalformedContentRange));
    match download(&lp, &s.url("f.bin"), &dir.file("malformed"), FIXED) {
        Err(DownloadError::Transfer(e)) => {
            assert_eq!(e.class, FailureClass::Permanent);
            assert!(e.message.contains("Content-Range"), "{}", e.message);
        }
        other => panic!("a malformed Content-Range must be refused: {other:?}"),
    }
    assert!(!dir.file("malformed").exists());

    let (s, data) = serve(1_000_000, in_mode(RangeMode::FullBodyForNonZeroStart));
    let r =
        download(&lp, &s.url("f.bin"), &dir.file("full"), FIXED).expect("the rest as one stream");
    assert!(std::fs::read(dir.file("full")).unwrap() == data);
    assert_eq!(r.mode, Mode::RangesLost);
    assert_eq!(r.written_bytes, 1_000_000);

    let (s, data) = serve(1_000_000, in_mode(RangeMode::UnknownTotal));
    let r = download(&lp, &s.url("f.bin"), &dir.file("unknown"), FIXED).expect("sequential");
    assert!(std::fs::read(dir.file("unknown")).unwrap() == data);
    assert_eq!(r.mode, Mode::SequentialRanges);

    let (s, data) = serve(1_000_000, in_mode(RangeMode::ShortRanges(100_000)));
    let r = download(&lp, &s.url("f.bin"), &dir.file("short"), FIXED).expect("short ranges");
    assert!(std::fs::read(dir.file("short")).unwrap() == data);
    assert_eq!((r.mode, r.wasted_bytes), (Mode::Ranges, 0));

    let (s, data) = serve(500_000, in_mode(RangeMode::Multipart));
    let r = download(&lp, &s.url("f.bin"), &dir.file("multipart"), FIXED).expect("retried once");
    assert!(std::fs::read(dir.file("multipart")).unwrap() == data);
    assert_eq!(r.mode, Mode::SingleStream);
    let ranges = s.counters().ranges;
    assert!(
        ranges.len() == 2 && ranges[0].is_some() && ranges[1].is_none(),
        "{ranges:?}"
    );

    for (status, class) in [
        (404, FailureClass::Permanent),
        (503, FailureClass::Throttled),
    ] {
        let (s, _) = serve(1000, in_mode(RangeMode::Status(status)));
        let dest = dir.file(&format!("status{status}"));
        let options = DownloadOptions {
            retry: RetryPolicy {
                failures_in_a_row: 1,
                ..RetryPolicy::DEFAULT
            },
            ..FIXED
        };
        match download(&lp, &s.url("f.bin"), &dest, options) {
            Err(DownloadError::Transfer(e)) => {
                assert_eq!((e.http_status, e.class), (Some(status), class));
            }
            other => panic!("{status} must fail: {other:?}"),
        }
        assert!(!dest.exists());
    }
}

#[test]
fn a_split_over_http2_resets_only_the_stream() {
    let _serial = one_at_a_time();
    // #42's criterion, moved to #47: the first later range is slow, so the other connection
    // finishes early and splits it. Over HTTP/2 the old request's stream is reset and the
    // connection stays: one TCP connection for the whole file.
    let (s, data) = serve(
        1_000_000,
        Http2Options {
            throttle_first_later_range: Some(300_000),
            ..Http2Options::default()
        },
    );
    let dir = Dir::new("split");
    let options = DownloadOptions {
        connections: 2,
        leases: Sizes {
            max_lease: 4 << 20,
            min_split: 32 << 10,
            align: 4 << 10,
        },
        ..FIXED
    };
    let r = download(&h2c_loop(), &s.url("f.bin"), &dir.file("f"), options).expect("split");
    assert!(std::fs::read(dir.file("f")).unwrap() == data);
    assert!(r.splits >= 1, "{r:?}");
    // The server sees the reset at its next paced send, which may come after the download ends.
    let deadline = std::time::Instant::now() + Duration::from_secs(5);
    while s.counters().streams_reset == 0 {
        assert!(
            std::time::Instant::now() < deadline,
            "the old request's stream was never reset: {:?}",
            s.counters()
        );
        std::thread::sleep(Duration::from_millis(20));
    }
    let c = s.counters();
    assert_eq!(c.connections, 1, "and the connection kept");
}

/// The engine's ramp with shorter windows, so a test runs in seconds. 4 asked for, so losing a
/// connection that helps costs at least 25%, well clear of the 10% threshold and of measurement
/// noise on a loaded machine.
const ADAPTIVE: DownloadOptions = DownloadOptions {
    connections: 4,
    adaptive: Some(AdaptivePolicy {
        // 1 s windows: each measurement averages twice the bytes of 500 ms ones, which kept
        // misjudging gains on CI's slower runners.
        min_window: Duration::from_secs(1),
        ..AdaptivePolicy::DEFAULT
    }),
    ..FIXED
};

#[test]
fn a_server_that_throttles_each_connection_gets_separate_connections() {
    let _serial = one_at_a_time();
    // 1 MiB/s per TCP connection, however many streams share it: more streams don't help, so the
    // downloader tries connections of their own, which do. 192 MiB, so the trial of its own
    // connections settles before the file ends (#168): at 64 MiB, the slower start of #221's ramp
    // left the trial unfinished when the file ended, on both platforms (batch run 41180516439).
    // Since #281 the trial judges a connection that helps twice, which settles it 4 windows later.
    let (s, data) = serve(
        192 * MIB,
        Http2Options {
            throttle_connection_bytes_per_sec: Some(MIB as u64),
            ..Http2Options::default()
        },
    );
    let dir = Dir::new("per-tcp");
    // 8 asked for (#168): the streams start at 8 and step down while the speed holds, so they stop
    // below 8 and the trial, which starts only on "no gain", runs. Each count takes 2 windows, so
    // after a first window that isn't measured, the streams settle by about 17 s and the trial's own
    // connections by about 26 s (#221, #281). The file ends at about 40 s.
    let options = DownloadOptions {
        connections: 8,
        ..ADAPTIVE
    };
    // What the ramp did, for the failure message: a CI runner once ran all 128 MiB at 8 streams
    // while every local run stepped down and tried connections of their own (#257).
    let control = Arc::new(Control::default());
    let timeline = {
        let control = Arc::clone(&control);
        Timeline::start(Duration::from_millis(500), move || {
            let now = control.connections_now();
            format!("{} running, tuned {:?}", now.active, now.tuned)
        })
    };
    let r = download_with(
        &h2c_loop(),
        &s.url("f.bin"),
        &dir.file("f"),
        options,
        &control,
    )
    .expect("done");
    assert!(std::fs::read(dir.file("f")).unwrap() == data);
    let c = s.counters();
    eprintln!(
        "per TCP connection: {} connections, at most {} streams at once",
        c.connections, c.peak_answering
    );
    assert!(
        r.own_connections,
        "it chose connections of their own: {r:?}\n{}",
        timeline.text()
    );
    // The mode is the criterion. How far the trial's own ramp got varies with the machine (CI's
    // Windows runner settled at 3), so this only checks several of its own ran together.
    assert!(
        c.peak_answering >= 3,
        "several connections of their own at once: {c:?}"
    );
    assert!(
        c.connections >= 4,
        "one for multiplexing, then one each: {c:?}"
    );
}

#[test]
fn a_server_that_throttles_each_stream_keeps_one_multiplexed_connection() {
    let _serial = one_at_a_time();
    // 1 MiB/s per stream: every added stream helps, so the downloader stays on one connection.
    let (s, data) = serve(
        32 * MIB,
        Http2Options {
            throttle_stream_bytes_per_sec: Some(MIB as u64),
            ..Http2Options::default()
        },
    );
    let dir = Dir::new("per-stream");
    let r = download(&h2c_loop(), &s.url("f.bin"), &dir.file("f"), ADAPTIVE).expect("done");
    assert!(std::fs::read(dir.file("f")).unwrap() == data);
    let c = s.counters();
    eprintln!(
        "per stream: {} connections, at most {} streams at once",
        c.connections, c.peak_answering
    );
    assert!(!r.own_connections, "{r:?}");
    assert_eq!(c.peak_answering, 4, "it kept the 4 asked for: {c:?}");
    assert_eq!(c.connections, 1, "as streams on one connection: {c:?}");
}

#[test]
fn a_server_that_rate_limits_extra_streams_gets_no_new_ones_until_its_wait_is_over() {
    let _serial = one_at_a_time();
    // proof.ovh.net over HTTP/2: one stream is served, and each stream beyond it is answered 429
    // (#247). With the app's adaptive connections, the download keeps the stream that works and
    // finishes, instead of opening stream after stream until the server blocks the client.
    let (s, data) = serve(
        12_000_000,
        Http2Options {
            limit_answering: Some(AnsweringLimit {
                max: 1,
                status: 429,
                retry_after: Some("1".into()),
            }),
            throttle_stream_bytes_per_sec: Some(500_000),
            ..Http2Options::default()
        },
    );
    let dir = Dir::new("rate-limited");
    let options = DownloadOptions {
        connections: 8,
        adaptive: Some(AdaptivePolicy::DEFAULT),
        retry: RetryPolicy {
            stalled_after: Duration::from_secs(2),
            reset_after: Duration::from_secs(4),
            ..RetryPolicy::DEFAULT
        },
        ..FIXED
    };
    download(&h2c_loop(), &s.url("f.bin"), &dir.file("out"), options)
        .expect("the download finishes on the stream the server allows");
    assert!(std::fs::read(dir.file("out")).unwrap() == data);
    let limited = s.counters().limited;
    // None at all, or one at the opening step (PO decision on #247).
    let Some(&first) = limited.first() else {
        return;
    };
    let after: Vec<_> = limited.iter().map(|t| *t - first).collect();
    assert!(
        after
            .iter()
            .filter(|d| **d > Duration::from_millis(300))
            .all(|d| *d >= Duration::from_secs(1)),
        "429s at {after:?} after the first"
    );
    let c = s.counters();
    let asked: Vec<_> = c
        .request_times
        .iter()
        .zip(&c.ranges)
        .map(|(t, r)| (t.saturating_duration_since(first), r))
        .collect();
    assert!(
        limited.len() <= 1,
        "{} streams refused: {after:?}; requests: {asked:?}",
        limited.len()
    );
}

#[test]
fn after_a_429_on_a_shared_connection_requests_get_connections_of_their_own() {
    let _serial = one_at_a_time();
    // #247: proof.ovh.net refuses a stream that comes while another is being answered on the same
    // HTTP/2 connection, and serves the same requests on connections of their own (curl.exe, V1).
    // Velocity's retries went on as streams of the shared connection, every one was refused, and
    // the server blocked the computer.
    let (s, data) = serve(
        8_000_000,
        Http2Options {
            limit_per_connection: Some(AnsweringLimit {
                max: 1,
                status: 429,
                retry_after: Some("1".into()),
            }),
            throttle_stream_bytes_per_sec: Some(2_000_000),
            ..Http2Options::default()
        },
    );
    let dir = Dir::new("per-connection-limit");
    download(&h2c_loop(), &s.url("f.bin"), &dir.file("out"), FIXED).expect("the download finishes");
    assert!(std::fs::read(dir.file("out")).unwrap() == data);
    let c = s.counters();
    assert!(
        c.connections > 1,
        "connections of their own after the 429s: {c:?}"
    );
    assert!(
        c.limited.len() <= 3,
        "only the first streams of the shared connection are refused: {} refusals",
        c.limited.len()
    );
}
