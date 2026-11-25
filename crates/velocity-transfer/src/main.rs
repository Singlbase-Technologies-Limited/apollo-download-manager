//! The `velocity-transfer` program (#37): the engine as a child process, and a command line for
//! running one download by hand.
//!
//! ```text
//! velocity-transfer serve
//! velocity-transfer get <url> <destination> [--connections N] [--probe-bytes B] [--adaptive]
//!                       [--record <file>] [--limit-kib N] [--limit-change S:KIB]
//! ```
//!
//! `--adaptive` runs the adaptive ramp the app uses (#47), from the count asked for. `--record`
//! writes a line every 100 ms while it runs (#330): milliseconds since the start, bytes written,
//! the file's size, the requests open and the ramp's count. Numbers only: never the link, the host
//! or the file's name. `--limit-kib` limits its speed, and `--limit-change` sets another limit after S
//! seconds (0: none), recorded as the line's last column.

use std::io::Write;
use std::path::PathBuf;
use std::process::ExitCode;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use velocity_curl::{CurlLoop, Libcurl, LoopOptions};
use velocity_transfer::adaptive::AdaptivePolicy;
use velocity_transfer::download::{download_with, Cadence, Control, DiskOptions, DownloadOptions};
use velocity_transfer::engine::{MAX_CONNECTIONS, PROBE_BYTES};
use velocity_transfer::retry::RetryPolicy;
use velocity_transfer::scheduler::Sizes;
use velocity_transfer::stdio;

const USAGE: &str = "usage:
  velocity-transfer serve
  velocity-transfer get <url> <destination> [--connections N] [--probe-bytes B] [--adaptive]
                        [--record <file>] [--limit-kib N] [--limit-change S:KIB]";

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = match args.first().map(String::as_str) {
        Some("serve") if args.len() == 1 => stdio::serve(),
        Some("get") => parse_get(&args[1..]).and_then(|(url, dest, options, record, limits)| {
            get(&url, dest, options, record, limits)
        }),
        _ => Err(USAGE.to_string()),
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("velocity-transfer: {message}");
            ExitCode::FAILURE
        }
    }
}

/// The speed limit in KiB/s, and a change to it after some seconds (#330).
#[derive(Default)]
struct Limits {
    kib: Option<u64>,
    change: Option<(u64, u64)>,
}

type GetArgs = (String, PathBuf, DownloadOptions, Option<PathBuf>, Limits);

fn parse_get(args: &[String]) -> Result<GetArgs, String> {
    let mut record = None;
    let mut limits = Limits::default();
    let mut positional = Vec::new();
    let mut options = DownloadOptions {
        disk: DiskOptions::DEFAULT,
        connections: 4,
        probe_bytes: PROBE_BYTES,
        leases: Sizes::DEFAULT,
        checkpoints: Cadence::DEFAULT,
        retry: RetryPolicy::DEFAULT,
        adaptive: None,
    };
    let mut rest = args.iter();
    while let Some(arg) = rest.next() {
        match arg.as_str() {
            "--connections" => {
                let n: u32 = number(rest.next(), "--connections")?;
                if !(1..=MAX_CONNECTIONS).contains(&n) {
                    return Err(format!("--connections must be 1 to {MAX_CONNECTIONS}"));
                }
                options.connections = n;
            }
            "--probe-bytes" => {
                options.probe_bytes = number(rest.next(), "--probe-bytes")?;
                if options.probe_bytes == 0 {
                    return Err("--probe-bytes must be at least 1".into());
                }
            }
            "--adaptive" => options.adaptive = Some(AdaptivePolicy::DEFAULT),
            "--limit-kib" => limits.kib = Some(number(rest.next(), "--limit-kib")?),
            "--limit-change" => {
                let v = rest.next().ok_or("--limit-change needs S:KIB")?;
                let (at, kib) = v.split_once(':').ok_or("--limit-change needs S:KIB")?;
                limits.change = Some((
                    at.parse().map_err(|_| "--limit-change needs S:KIB")?,
                    kib.parse().map_err(|_| "--limit-change needs S:KIB")?,
                ));
            }
            "--record" => {
                record = Some(PathBuf::from(rest.next().ok_or("--record needs a file")?));
            }
            flag if flag.starts_with("--") => {
                return Err(format!("unknown option {flag}\n{USAGE}"))
            }
            value => positional.push(value),
        }
    }
    match positional.as_slice() {
        [url, dest] => Ok((
            url.to_string(),
            PathBuf::from(dest),
            options,
            record,
            limits,
        )),
        _ => Err(USAGE.to_string()),
    }
}

fn number<T: std::str::FromStr>(value: Option<&String>, flag: &str) -> Result<T, String> {
    value
        .and_then(|v| v.parse().ok())
        .ok_or_else(|| format!("{flag} needs a number"))
}

fn get(
    url: &str,
    destination: PathBuf,
    options: DownloadOptions,
    record: Option<PathBuf>,
    limits: Limits,
) -> Result<(), String> {
    let limit = velocity_curl::RateLimit::new(limits.kib.map(|k| k * 1024));
    let libcurl = Libcurl::start().map_err(|e| e.to_string())?;
    let loop_options = LoopOptions {
        // Each request's end on stderr (#263), as the engine logs them.
        on_request_end: Some(velocity_transfer::request_log::stderr_hook()),
        ..LoopOptions::default()
    };
    let lp = CurlLoop::start(&libcurl, loop_options).map_err(|e| e.to_string())?;
    let started = Instant::now();
    let shown = AtomicU64::new(0);
    // What the recorder samples (#330): the bytes written and the file's size so far.
    let progress = Arc::new((AtomicU64::new(0), AtomicU64::new(0)));
    let seen = Arc::clone(&progress);
    let control = Control::with_progress(move |written, total| {
        seen.0.store(written, Ordering::Relaxed);
        seen.1.store(total.unwrap_or(0), Ordering::Relaxed);
        // A line per 8 MiB, on stderr, so stdout carries only the report.
        if written >= shown.load(Ordering::Relaxed) + 8 * 1024 * 1024 {
            shown.store(written, Ordering::Relaxed);
            match total {
                Some(t) => eprintln!("{written} / {t} bytes"),
                None => eprintln!("{written} bytes"),
            }
        }
    });
    // The User-Agent the app sends (#40): some servers, such as Hetzner's speed-test ones, close a
    // connection whose request has none (#330).
    let control =
        control
            .with_limits(vec![limit.clone()])
            .with_request(velocity_curl::RequestOptions {
                user_agent: Some(velocity_core::request::default_user_agent()),
                ..velocity_curl::RequestOptions::default()
            });
    let done = AtomicBool::new(false);
    let report = std::thread::scope(|scope| -> Result<_, String> {
        let recorder = record
            .map(|path| -> Result<_, String> {
                let mut file = std::io::BufWriter::new(
                    std::fs::File::create(&path).map_err(|e| e.to_string())?,
                );
                writeln!(file, "ms,bytes,total,active,tuned,limit_kib")
                    .map_err(|e| e.to_string())?;
                let (control, progress, done, limit) = (&control, &progress, &done, &limit);
                let change = limits.change;
                Ok(scope.spawn(move || -> std::io::Result<()> {
                    loop {
                        let now = control.connections_now();
                        let tuned = now.tuned.map_or(String::new(), |(n, _)| n.to_string());
                        if let Some((at, kib)) = change {
                            if started.elapsed().as_secs() >= at
                                && limit.get() != (kib > 0).then_some(kib * 1024)
                            {
                                limit.set((kib > 0).then_some(kib * 1024));
                            }
                        }
                        let shown = limit
                            .get()
                            .map_or(String::new(), |b| (b / 1024).to_string());
                        writeln!(
                            file,
                            "{},{},{},{},{tuned},{shown}",
                            started.elapsed().as_millis(),
                            progress.0.load(Ordering::Relaxed),
                            progress.1.load(Ordering::Relaxed),
                            now.active
                        )?;
                        if done.load(Ordering::Relaxed) {
                            return file.flush();
                        }
                        std::thread::sleep(Duration::from_millis(100));
                    }
                }))
            })
            .transpose()?;
        let report = download_with(&lp, url, &destination, options, &control);
        done.store(true, Ordering::Relaxed);
        if let Some(recorder) = recorder {
            recorder
                .join()
                .map_err(|_| "the recorder stopped".to_owned())?
                .map_err(|e| e.to_string())?;
        }
        report.map_err(|e| format!("{e:?}"))
    })?;
    let seconds = started.elapsed().as_secs_f64();
    println!(
        "mode={:?} bytes={} fetches={} written={} wasted={} seconds={seconds:.3} mib_per_s={:.2}",
        report.mode,
        report.total,
        report.fetches,
        report.written_bytes,
        report.wasted_bytes,
        report.total as f64 / (1024.0 * 1024.0) / seconds.max(f64::EPSILON)
    );
    Ok(())
}
