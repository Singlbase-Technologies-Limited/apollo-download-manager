//! Downloads through the user's proxy (#192, ADR-0008), against the local proxy fixtures: an HTTP
//! proxy that only tunnels, and a SOCKS5 proxy that resolves names. Real libcurl, real sockets.
//! Each test checks the connection went through the proxy, that the proxy's login went to the
//! proxy alone, and what the local-address guard (#67) does through a proxy.

use std::net::{IpAddr, Ipv4Addr};
use std::sync::Arc;
use std::time::Duration;

use velocity_curl::{
    AddressProblem, CurlFailure, CurlLoop, FetchError, FetchEvent, FetchRequest, Gate, Libcurl,
    LoopOptions, ProxyConfig, ProxyKind, RequestOptions,
};
use velocity_test_http::proxy::{HttpProxy, Socks5Proxy};
use velocity_test_http::{seeded_bytes, ServerOptions, TestServer};

const PROXY_USER: &str = "proxy-user";
const PROXY_PASSWORD: &str = "PROXY-PASSWORD-192";

fn curl_loop() -> CurlLoop {
    CurlLoop::start(
        &Libcurl::start().expect("libcurl starts"),
        LoopOptions::default(),
    )
    .expect("the loop starts")
}

fn proxy(kind: ProxyKind, port: u16, login: bool) -> ProxyConfig {
    ProxyConfig {
        kind,
        host: "127.0.0.1".to_owned(),
        port,
        login: login.then(|| (PROXY_USER.to_owned(), PROXY_PASSWORD.to_owned())),
    }
}

/// Fetches `url` with `options`, and returns its body and how it ended.
fn fetch(l: &CurlLoop, url: String, options: RequestOptions) -> (Vec<u8>, Result<(), FetchError>) {
    let f = l.fetch(
        FetchRequest::get(url).with_options(Arc::new(options)),
        |_| Gate::Accept,
    );
    let mut body = Vec::new();
    loop {
        match f
            .next_event(Duration::from_secs(30))
            .expect("an event in time")
        {
            FetchEvent::Head(_) => {}
            FetchEvent::Data(chunk) => body.extend_from_slice(&chunk),
            FetchEvent::Done(done) => return (body, done),
        }
    }
}

fn server(data: &[u8]) -> TestServer {
    TestServer::start(
        vec![("a.bin".into(), data.to_vec())],
        ServerOptions::default(),
    )
}

#[test]
fn a_download_goes_through_an_http_proxy_as_a_tunnel() {
    let data = seeded_bytes(200_000, 192);
    let server = server(&data);
    let proxy_server = HttpProxy::start(None);
    let options = RequestOptions {
        proxy: Some(proxy(ProxyKind::Http, proxy_server.port(), false)),
        ..RequestOptions::default()
    };
    let (body, done) = fetch(&curl_loop(), server.url("a.bin"), options);
    assert_eq!(done, Ok(()));
    assert!(body == data);
    let record = proxy_server.record();
    assert_eq!(record.targets.len(), 1, "{record:?}");
    assert!(
        record.targets[0].ends_with(&format!(":{}", server.addr().port())),
        "{record:?}"
    );
    assert_eq!(
        record.plain_requests, 0,
        "even http:// is tunnelled: the proxy reads no request"
    );
}

/// The proxy's own answer to `CONNECT` never reaches the gate as the server's (#344). It has no
/// ETag, so on every new tunnel after the first the engine took it for a file that changed.
#[test]
fn only_the_servers_answer_reaches_the_gate_through_an_http_proxy() {
    let data = seeded_bytes(200_000, 344);
    let server = TestServer::start(
        vec![("a.bin".into(), data.clone())],
        ServerOptions {
            file_headers: velocity_test_http::FileHeaders {
                etag: Some("\"v344\"".to_owned()),
                ..Default::default()
            },
            ..ServerOptions::default()
        },
    );
    let proxy_server = HttpProxy::start(None);
    let options = Arc::new(RequestOptions {
        proxy: Some(proxy(ProxyKind::Http, proxy_server.port(), false)),
        ..RequestOptions::default()
    });
    let l = curl_loop();
    // Two ranges, as two connections of one download would ask.
    for (start, end) in [(0, 99_999), (100_000, 199_999)] {
        let heads = Arc::new(std::sync::Mutex::new(Vec::new()));
        let seen = Arc::clone(&heads);
        let f = l.fetch(
            FetchRequest::range(server.url("a.bin"), start, Some(end))
                .with_options(Arc::clone(&options)),
            move |head| {
                seen.lock()
                    .expect("not poisoned")
                    .push((head.status, head.header("etag").map(str::to_owned)));
                Gate::Accept
            },
        );
        let mut body = Vec::new();
        let done = loop {
            match f
                .next_event(Duration::from_secs(30))
                .expect("an event in time")
            {
                FetchEvent::Head(_) => {}
                FetchEvent::Data(chunk) => body.extend_from_slice(&chunk),
                FetchEvent::Done(done) => break done,
            }
        };
        assert_eq!(done, Ok(()), "bytes {start}-{end}");
        assert!(body == data[start as usize..=end as usize]);
        assert_eq!(
            *heads.lock().expect("not poisoned"),
            [(206, Some("\"v344\"".to_owned()))],
            "bytes {start}-{end}: the gate saw only the server's answer"
        );
    }
}

/// A proxy that wants a login when none is set refuses as a proxy (#344), not as the server's
/// `407`, so the message points to Settings, Proxy.
#[test]
fn a_proxy_asking_for_a_login_none_was_given_says_so() {
    let server = server(&seeded_bytes(1_000, 345));
    let http = HttpProxy::start(Some((PROXY_USER, PROXY_PASSWORD)));
    let options = Arc::new(RequestOptions {
        proxy: Some(proxy(ProxyKind::Http, http.port(), false)),
        ..RequestOptions::default()
    });
    // The engine's gate refuses a `407` head as the server's own refusal, so none may reach it.
    let heads = Arc::new(std::sync::Mutex::new(Vec::new()));
    let seen = Arc::clone(&heads);
    let l = curl_loop();
    let f = l.fetch(
        FetchRequest::get(server.url("a.bin")).with_options(options),
        move |head| {
            seen.lock().expect("not poisoned").push(head.status);
            Gate::Abort(format!("HTTP {}", head.status))
        },
    );
    let done = loop {
        if let FetchEvent::Done(done) = f.next_event(Duration::from_secs(30)).expect("an event") {
            break done;
        }
    };
    assert_eq!(*heads.lock().expect("not poisoned"), Vec::<u16>::new());
    match done {
        Err(FetchError::Curl { kind, .. }) => assert_eq!(kind, CurlFailure::ProxyRefused),
        other => panic!("{other:?}"),
    }
    assert_eq!(server.counters().gets, 0, "nothing reached the server");
}

#[test]
fn a_download_goes_through_a_socks5_proxy_which_resolves_the_name() {
    let data = seeded_bytes(200_000, 193);
    let server = server(&data);
    // A name only the proxy knows: had libcurl resolved it, the fetch would fail.
    let proxy_server = Socks5Proxy::start(
        None,
        &[("files.velocity-test", IpAddr::V4(Ipv4Addr::LOCALHOST))],
    );
    let url = format!("http://files.velocity-test:{}/a.bin", server.addr().port());
    let options = RequestOptions {
        proxy: Some(proxy(ProxyKind::Socks5, proxy_server.port(), false)),
        ..RequestOptions::default()
    };
    let (body, done) = fetch(&curl_loop(), url, options);
    assert_eq!(done, Ok(()));
    assert!(body == data);
    assert_eq!(
        proxy_server.record().targets,
        [format!("files.velocity-test:{}", server.addr().port())]
    );
}

#[test]
fn the_proxy_login_goes_to_the_proxy_alone() {
    let data = seeded_bytes(50_000, 194);
    let l = curl_loop();
    for (kind, record) in [
        (ProxyKind::Http, {
            let p = HttpProxy::start(Some((PROXY_USER, PROXY_PASSWORD)));
            let server = server(&data);
            let options = RequestOptions {
                login: Some(("site-user".to_owned(), "site-password".to_owned())),
                proxy: Some(proxy(ProxyKind::Http, p.port(), true)),
                ..RequestOptions::default()
            };
            let (body, done) = fetch(&l, server.url("a.bin"), options);
            assert_eq!(done, Ok(()));
            assert!(body == data);
            let seen = server.counters().requests;
            assert!(!seen.is_empty());
            for request in &seen {
                assert_eq!(request.header("Proxy-Authorization"), None, "{request:?}");
                assert!(
                    request
                        .headers
                        .iter()
                        .all(|(_, v)| !v.contains(PROXY_PASSWORD)),
                    "{request:?}"
                );
                assert!(
                    request.header("Authorization").is_some(),
                    "the site's own login still goes"
                );
            }
            p.record()
        }),
        (ProxyKind::Socks5, {
            let p = Socks5Proxy::start(Some((PROXY_USER, PROXY_PASSWORD)), &[]);
            let server = server(&data);
            let options = RequestOptions {
                proxy: Some(proxy(ProxyKind::Socks5, p.port(), true)),
                ..RequestOptions::default()
            };
            let (body, done) = fetch(&l, server.url("a.bin"), options);
            assert_eq!(done, Ok(()));
            assert!(body == data);
            for request in server.counters().requests {
                assert!(request
                    .headers
                    .iter()
                    .all(|(_, v)| !v.contains(PROXY_PASSWORD)));
            }
            p.record()
        }),
    ] {
        assert!(
            record
                .logins
                .contains(&Some((PROXY_USER.to_owned(), PROXY_PASSWORD.to_owned()))),
            "{kind:?}: {record:?}"
        );
    }
}

#[test]
fn a_refused_proxy_login_says_so() {
    let data = seeded_bytes(1_000, 195);
    let server = server(&data);
    let l = curl_loop();
    let http = HttpProxy::start(Some((PROXY_USER, "another password")));
    let socks = Socks5Proxy::start(Some((PROXY_USER, "another password")), &[]);
    for (kind, port) in [
        (ProxyKind::Http, http.port()),
        (ProxyKind::Socks5, socks.port()),
    ] {
        let options = RequestOptions {
            proxy: Some(proxy(kind, port, true)),
            ..RequestOptions::default()
        };
        let (_, done) = fetch(&l, server.url("a.bin"), options);
        match done {
            Err(FetchError::Curl { kind: failure, .. }) => {
                assert_eq!(failure, CurlFailure::ProxyRefused, "{kind:?}")
            }
            other => panic!("{kind:?}: {other:?}"),
        }
    }
    assert_eq!(server.counters().gets, 0, "nothing reached the server");
}

/// Through a proxy, the connection is to the proxy, which the user chose (PO decision on #192):
/// a browser link that names this computer itself still stops, and one whose name only the proxy
/// resolves goes on, even to a local address. That gap is documented (docs/SECURITY.md).
#[test]
fn through_a_proxy_only_a_link_naming_a_local_address_stops() {
    let data = seeded_bytes(1_000, 196);
    let server = server(&data);
    let socks = Socks5Proxy::start(
        None,
        &[("files.velocity-test", IpAddr::V4(Ipv4Addr::LOCALHOST))],
    );
    let l = curl_loop();
    let guarded = RequestOptions {
        confirm_local_addresses: true,
        proxy: Some(proxy(ProxyKind::Socks5, socks.port(), false)),
        ..RequestOptions::default()
    };
    let (_, done) = fetch(&l, server.url("a.bin"), guarded.clone());
    match done {
        Err(FetchError::LocalAddress(AddressProblem { host, address })) => {
            assert_eq!(host, "127.0.0.1");
            assert_eq!(address, "127.0.0.1");
        }
        other => panic!("{other:?}"),
    }
    let by_name = format!("http://files.velocity-test:{}/a.bin", server.addr().port());
    let (body, done) = fetch(&l, by_name, guarded);
    assert_eq!(done, Ok(()));
    assert!(body == data);
    assert_eq!(
        server.counters().gets,
        1,
        "only the link by name reached the server"
    );
}
