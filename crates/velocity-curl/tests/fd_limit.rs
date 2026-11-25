//! A process with more than 1024 files open still downloads (#337, Linux): a socket numbered above
//! `FD_SETSIZE` can't be waited on with `select()`, and some libcurl builds fall back to it. The
//! loop waits with `curl_multi_poll` (curl's `poll_7_68_0` feature), which has no such limit; this
//! test keeps it so. Its own test binary, so the files it holds open touch no other test.
#![cfg(target_os = "linux")]

use std::fs::File;
use std::os::fd::AsRawFd;
use std::time::{Duration, Instant};

use velocity_curl::{CurlLoop, FetchEvent, FetchRequest, Gate, Libcurl, LoopOptions, ResponseHead};
use velocity_test_http::{seeded_bytes, ServerOptions, TestServer};

/// More files than `select()` can watch.
const OPEN: usize = 1_100;

#[test]
fn fetches_with_more_than_1024_files_open() {
    // The soft limit is often 1024: it goes up to the hard one, which needs no privilege.
    let mut limit = libc::rlimit {
        rlim_cur: 0,
        rlim_max: 0,
    };
    // SAFETY: getrlimit and setrlimit only read and write the `rlimit` passed by pointer, which
    // lives for the call.
    let raised = unsafe {
        libc::getrlimit(libc::RLIMIT_NOFILE, &mut limit) == 0 && {
            limit.rlim_cur = limit.rlim_max;
            libc::setrlimit(libc::RLIMIT_NOFILE, &limit) == 0
        }
    };
    assert!(raised, "the open-file limit couldn't be raised");
    assert!(
        limit.rlim_cur as usize > OPEN + 64,
        "a hard limit of {} files is too low for this test",
        limit.rlim_cur
    );

    let held: Vec<File> = (0..OPEN)
        .map(|_| File::open("/dev/null").expect("/dev/null opens"))
        .collect();
    assert!(
        held.last().map(AsRawFd::as_raw_fd).unwrap_or(0) > 1024,
        "the files held reach past descriptor 1024"
    );

    let data = seeded_bytes(300_000, 337);
    let server = TestServer::start(
        vec![("a.bin".into(), data.clone())],
        ServerOptions::default(),
    );
    let curl = Libcurl::start().expect("libcurl starts");
    let lp = CurlLoop::start(&curl, LoopOptions::default()).expect("the loop starts");
    let fetch = lp.fetch(
        FetchRequest::get(server.url("a.bin")),
        |_: &ResponseHead| Gate::Accept,
    );
    let deadline = Instant::now() + Duration::from_secs(20);
    let mut body = Vec::new();
    let done = loop {
        match fetch
            .next_event(deadline.saturating_duration_since(Instant::now()))
            .expect("the fetch finishes in time")
        {
            FetchEvent::Head(_) => {}
            FetchEvent::Data(chunk) => body.extend_from_slice(&chunk),
            FetchEvent::Done(done) => break done,
        }
    };
    assert_eq!(done, Ok(()), "with {OPEN} files open");
    assert!(body == data, "the body differs from the source");
    drop(held);
}
