# Engine internals

How the direct-download engine in [`crates/velocity-transfer`](../crates/velocity-transfer/) fetches a file. Checked against the code at commit `9a4f484` (2026-10-30, #80). The contract the manager sees is in [ENGINE_CONTRACT.md](ENGINE_CONTRACT.md), and how the engine's child process talks to the app is in [ENGINE_PROTOCOL.md](ENGINE_PROTOCOL.md). The design comes from section 5 of the [research report](research/2026-10-21-libcurl-engine-research-r2.md); the terms are in the [glossary](GLOSSARY.md).

Metalink and mirrors are in [ENGINE_METALINK_MIRRORS.md](ENGINE_METALINK_MIRRORS.md).

FTP, FTPS and SFTP are in [ENGINE_FTP_SFTP.md](ENGINE_FTP_SFTP.md).

The scheduler and connections are in [ENGINE_SCHEDULER.md](ENGINE_SCHEDULER.md); persistence, changed files and integrity in [ENGINE_PERSISTENCE.md](ENGINE_PERSISTENCE.md); the engine's tests in [ENGINE_TESTS.md](ENGINE_TESTS.md).

See also, for users: [Protocols and limits](user/protocols.md).

## The probe (#41)

The probe is the download's first request and also its first segment, so its bytes are kept. It is `GET` with `Range: bytes=0-(S−1)`, where S is `DownloadOptions::probe_bytes`. That's 4 MiB in the engine, the report's starting value for #47 to tune.

- **No HEAD:** a HEAD request is never sent, and `Accept-Ranges` is never taken as proof of range support.
- **No encoding asked for:** no `Accept-Encoding` is sent. An encoding the server applies anyway is kept, its bytes stored as sent ([changed files](ENGINE_PERSISTENCE.md#changed-files-45)).
- **Decided before any byte:** the final response is classified in libcurl's header callback ([`probe.rs`](../crates/velocity-transfer/src/probe.rs)). An answer the engine refuses is aborted there, so none of its body is written.

| Final response | What the engine does | `Mode` |
|---|---|---|
| `206`, `Content-Range: bytes 0-b/T` | Keeps bytes 0 to b, then fetches the rest as parallel segments | `Ranges` |
| `206` with fewer bytes than asked (b < S−1) | Keeps them; the rest is part of the segments | `Ranges` |
| `206`, `bytes 0-b/*` (no total) | Keeps bytes 0 to b. It asks for the rest with one open range, `bytes=(b+1)-`, and repeats from the first missing byte until a `416` says the file ends there. No parallel segments | `SequentialRanges` |
| `206` `multipart/byteranges` | Aborts, and retries once without `Range` | `SingleStream` after the retry |
| `200` | Keeps this response as the whole file: no second request, nothing wasted | `SingleStream` |
| `416` with `bytes */0` | An empty file | `Empty` |
| `401`, `407` | Fails: the server or proxy requires authentication. Never retried | — |
| `429`, `503` | Throttled: retried after the wait `Retry-After` asks for ([retries](ENGINE_RETRIES_LIMITS.md#retries-waits-and-stalls-48)) | — |
| Other `4xx` | Fails, never retried (`408` is retried) | — |
| Other `5xx` | Retried after a wait | — |
| No answer: the connection failed | Retried after a wait | — |
| A malformed `Content-Range`, a `Content-Length` that disagrees with it, a start other than 0, an end past the request or the total | Fails before writing, not retryable | — |

## Redirects (#40)

Apollo Download Manager follows redirects itself; libcurl's `CURLOPT_FOLLOWLOCATION` is off. libcurl would follow one with every custom header, and it drops only `Authorization` and `Cookie` when the host changes. When a response is a `3xx` with a `Location`, the libcurl loop drops its body, reads the next URL as libcurl resolved it (`CURLINFO_REDIRECT_URL`), and checks the hop ([`redirect.rs`](../crates/velocity-curl/src/redirect.rs)):

- **Protocols:** only `http` and `https`. A redirect to `ftp`, `sftp`, `scp`, `file` or anything else is refused before any connection. libcurl's `CURLOPT_REDIR_PROTOCOLS_STR` stays set to `http,https` as a second barrier.
- **No downgrade:** a redirect from `https` to `http` is refused, unless the user confirmed it for this download (`trust.insecureRedirectConfirmed`, #67; [SECURITY.md](SECURITY.md#links-redirects-and-local-addresses-67)).
- **At most 10** redirects per request; the 11th is refused.
- **Origins:** the next request carries the login and the custom headers only when it goes to the first URL's origin: its scheme, host and port. The origin is read with libcurl's own URL parser ([`url.rs`](../crates/velocity-curl/src/url.rs), `curl_url`), so Apollo Download Manager and libcurl agree on the host. For example, `http://evil.example\@good.example/` goes to `good.example` for both. The user agent and the referrer go with every request.

The same handle is reset and set up again for each hop, so nothing from the last hop carries over. A refusal ends the request as `FetchError::RedirectRefused`, and the download fails with a message that names the protocol, never the URL. Each segment request follows the redirects from the first URL again, so a link that redirects to a short-lived URL works for every segment.

## File names (#40)

A spec without a `fileName` downloads into its folder, and the server's first answer names the file:

1. The `Content-Disposition` header (RFC 6266): `filename*` (RFC 8187, UTF-8 or ISO-8859-1) wins over `filename`. Any path in it is dropped, so `../../x.sh` gives `x.sh`.
2. Else the final URL's last path segment, after redirects, percent-decoded.
3. Else `download`.

The name is then sanitised ([`naming.rs`](../crates/velocity-core/src/naming.rs), ported from V1): separators, control characters and `< > : " | ? *` become `_`, leading dots and trailing dots and spaces go, Windows device names such as `CON.txt` get a `_` in front, a name ending in `.vdmpart` gets one at the end, and the name is cut to 240 bytes, keeping its extension. When the name is taken by a file, a link or a part file, the first free `name (n).ext` is used, n from 1 to 9999 (PO decision on #40), so no file is ever replaced.

- **No extra request:** the part file is created when the probe's first byte arrives, or when the probe ends without a body, as for an empty file. Before that nothing is on disk; a pause then keeps nothing, and the next attempt asks again.
- **Reported:** the engine reports the name in the snapshot's `fileName`. From then on, retries, pauses and cancels use that file.
- **Given names:** a spec that gives `fileName` is saved under it, and it fails with `FileExists` when the name is taken; #31 adds the conflict settings. `naming::file_name_for_link` decides whether a link names its file on its own: `report.pdf` does, `download.php?id=3` and `/files/12345` don't, so those are left to the server. The manager uses it through `naming::name_for_download` when a download is added (#31).

## Proxy (#192)

The proxy the user set ([SETTINGS.md](SETTINGS.md#proxy), [ADR-0008](decisions/0008-proxy-support.md)) reaches the engine through `set_proxy` (transfer contract version 16). The engine keeps it, and each transfer reads it as its worker starts, so a download that starts, resumes or retries uses the proxy of that moment. The supervisor gives it to a new engine before anything else.

- **libcurl (HTTP, HTTPS, FTP):** `CURLOPT_PROXY` is always set: the proxy, or empty, so `http_proxy`, `ALL_PROXY` and the like are never used. Through an HTTP or HTTPS proxy every connection is a `CONNECT` tunnel (`CURLOPT_HTTPPROXYTUNNEL`), even for `http://` and FTP, so the proxy never reads a request, its headers or a site's login. The proxy's own answer to `CONNECT` is kept from the header callback (`CURLOPT_SUPPRESS_CONNECT_HEADERS`), so the engine sees only the server's: before #344 a new tunnel's `200 Connection established`, with no ETag, was taken for a file that changed. A SOCKS5 proxy is used as `socks5h`: the proxy resolves the names. The proxy's login goes in `CURLOPT_PROXYUSERNAME` and `CURLOPT_PROXYPASSWORD`, Basic only, to the proxy alone; an HTTPS proxy's certificate is verified as a server's.
- **SFTP:** russh has no proxy support, so velocity-sftp opens the connection itself (`proxy.rs`): an HTTP `CONNECT` tunnel with `Proxy-Authorization: Basic`, or a SOCKS5 `CONNECT` by name with RFC 1929's login, and russh runs over it (`connect_stream`). The host key is checked against the server's name as without a proxy. An HTTPS proxy is refused: "SFTP can't go through an HTTPS proxy" (PO decision on #192).
- **A refused proxy:** an HTTP proxy's `407` to `CONNECT` (read from `CURLINFO_HTTP_CONNECTCODE`, also when no login was set), or a SOCKS5 refusal, fails the download as permanent: "The proxy refused the connection. Check its user name and password in Settings, Proxy."
- **Local addresses (#67):** through a proxy, the connection is to the proxy, which the user chose, so its address isn't held. A browser link that names this computer or a private network itself (`localhost`, or a local IP address) still stops before its request; a name only the proxy resolves can't be checked ([SECURITY_NETWORK.md](SECURITY_NETWORK.md#proxy-192)).
- **Tests:** velocity-curl `tests/proxy.rs` and `tests/no_ambient_proxy.rs`, velocity-sftp `tests/sftp.rs`, against the local proxies in `velocity_test_http::proxy` ([TESTING.md](TESTING.md)).
