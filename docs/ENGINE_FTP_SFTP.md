# Engine: FTP and SFTP

How the transfer engine downloads over FTP, FTPS and SFTP. Part of the engine's internals ([ENGINE_INTERNALS.md](ENGINE_INTERNALS.md)); split from it by #425.

## FTP and FTPS (#51)

`ftp://` and `ftps://` links download through the same engine as HTTP. FTP has no response head, so the libcurl layer builds one from the server's control replies before the first body byte ([`ftp.rs`](../crates/velocity-curl/src/ftp.rs)). The probe, the gate, the validators, the checkpoints and the completion gate then work as they do for HTTP.

### The head from the replies

libcurl passes FTP's control replies to the header callback (`213 1234` for a `SIZE`), and only its debug output shows which command each reply answers. The libcurl layer turns debug output on for FTP links only, reads the verb of each command sent (`SIZE`, `MDTM`, `REST`, `RETR`), and pairs it with the next reply. It keeps nothing else from that output, so the `PASS` line never leaves the callback.

| What the replies say | The head | When |
|---|---|---|
| `RETR` started (`150` or `125`), no range asked | `200`, `Content-Length` from `SIZE` | At the `RETR` reply |
| `RETR` started, a range from byte a, `SIZE` gave T | `206`, `Content-Range: bytes a-b/T`, where b is the range's end or T−1 | At the `RETR` reply |
| A range from byte a > 0, and `SIZE` says T ≤ a | `416`, `Content-Range: bytes */T`. libcurl doesn't retrieve such a file, and the fetch ends without a body, like an HTTP `416` | At the `SIZE` reply |
| Byte 0 of an empty file (T = 0) | `416`, `bytes */0`: an empty file, as for HTTP | At the `RETR` reply |
| `REST` refused (any reply but `350`) | `200`: the server can't start part way | At the `REST` reply |
| A range, but no size (`SIZE` refused) | `200` without a length: nothing proves the range | At the `RETR` reply |
| `MDTM` gave a time | `Last-Modified`, with a `Date` of now | Added to the head |
| `RETR` failed: `550` | No head; the fetch fails as `NotFound` | — |

- **A range is `REST`:** the start is sent as `REST` (`CURLOPT_RESUME_FROM_LARGE`), and the range's end is the fetch's body limit, which stops the transfer there.
- **No byte from another offset:** a `200` for a range after byte 0 is aborted before any byte, whatever the gate says, because its bytes would start at the `REST` offset and not at byte 0. A body that arrives before any head is refused too.
- **The date as a validator:** `MDTM` (RFC 3659 §3) is in UTC, to the second. With the head's `Date` of now, it is a strong date once it is at least a second old ([changed files](ENGINE_PERSISTENCE.md#changed-files-45)), so a resume is checked against it as `Last-Modified` is for HTTP. A file whose time changed since its checkpoint starts over. Without `MDTM`, a resume is kept on its size alone and shows "not verified" ([ADR-0010](decisions/0010-resume-without-validator.md)). FTP has nothing like `If-Range`: the time is compared in the gate, before any byte is written.

### One connection, one stream

An FTP download uses one connection, whatever is asked (PO decision on #51): each FTP transfer opens a control and a data connection, and nobody has measured whether more help (#77, which was to, was closed as not planned). `set_connections` returns 1 for it. `DownloadOptions::one_connection` makes the probe ask for the whole file, so a download that isn't cut is one transfer. What a cut, a pause or a crash leaves is one lease to the end, so one `REST`. A server that refuses `REST` sends the whole file again, and only the missing bytes are written (`RangesLost`). The per-host cap counts FTP on port 21 and FTPS on 990 unless the link names another.

### Logins and encryption

- **The login** comes from the spec's `credentials` and goes out as FTP's `USER` and `PASS`. Without one, libcurl logs in as `anonymous`. A link with a login in it is refused by the engine; the app splits it off first and never stores it (`database::without_login`). FTP has no redirects, so the origin rules don't apply.
- **Plain FTP sends the login and the file in clear.** The engine reports what it can encrypt per protocol (`ProtocolCapabilities::encryption`), and the Add download form shows `cleartextWarning` from [`src/capabilities.ts`](../src/capabilities.ts) before it starts a plain `ftp://` download, with the choice to require encryption (#60, PO decision on #51).
- **Explicit FTPS:** a download that requires encryption (`TransferSpec::require_encryption`) asks `AUTH TLS` before the login, then `PBSZ 0` and `PROT P`, so the data connections are TLS too (`CURLUSESSL_ALL`, `CURLFTPAUTH_TLS`). A server that refuses fails the download at once, as `EncryptionRefused`, before the login is sent. There is no fallback to plain FTP.
- **Implicit FTPS:** an `ftps://` link is TLS from the first byte, on both connections.
- **Certificates** are verified as for HTTPS, with the platform's trust store ([SECURITY_NETWORK.md](SECURITY_NETWORK.md#tls-verification-69)). A refused one fails at once, before the login.
- **Passive mode only,** to the control connection's address: the address in a `PASV` reply is ignored (`CURLOPT_FTP_SKIP_PASV_IP`), so a server can't send the data connection to another host.
- **An `http://` link that requires encryption is refused** (`InvalidInput`): it can't be encrypted.

### Failures

| What happened | Kind | Retried |
|---|---|---|
| The file isn't there (`550`) | `NotFound`: "The file wasn't found on the server." | No |
| The login was refused (`530`), or access to the file | `AccessDenied` | No |
| Encryption is required, and `AUTH TLS` was refused | `EncryptionRefused` | No |
| The data connection broke part way | `Interrupted` | Yes, from the first missing byte, with `REST` |

### FTPS: the evaluation #51 asked for

#51 asked for a written evaluation of FTPS with a recommendation. The PO decided to build it in #51, explicit and implicit, and #22, which the issue names, is the closed parity inventory, so the evaluation is here.

- **Certificate verification (verified):** FTPS uses the same TLS stack as HTTPS: Schannel with the Windows store on Windows, OpenSSL on Linux. The tests run explicit and implicit FTPS against the test CA of #69 on both, and a refused certificate, an untrusted issuer or an expired leaf, fails before the login. The FTP server presents a [`TestPki`](../crates/velocity-test-http/src/tls.rs) leaf, with its revocation list served, as the HTTPS front does.
- **Server compatibility (partly verified):** explicit FTPS with `AUTH TLS` (RFC 4217) is the common form, and implicit FTPS on port 990 is the older one; both work against the test server. Not verified: some servers require the data connection to resume the control connection's TLS session (vsftpd's `require_ssl_reuse`, for example). libcurl reuses TLS sessions by default, but the test server doesn't require it, so that combination has no test. `CCC` (dropping TLS after the login) isn't used.
- **Cost (not measured):** each FTPS transfer adds a TLS handshake on the control connection and one on the data connection. No measurement exists (ADR-0009).
- **Recommendation:** as built. Require encryption wherever the server offers FTPS, and keep plain FTP for servers that don't, with the warning.

## SFTP (#53)

`sftp://` links download on russh, in [`crates/velocity-sftp`](../crates/velocity-sftp/) ([ADR-0013](decisions/0013-sftp-russh.md)). The engine fetches through one interface, `velocity_curl::Transport`, so SFTP shares everything after the connection with HTTP and FTP: the probe, the gate, checkpoints, retries, speed limits and the completion gate.

### One transport interface

- **`Transport`:** the engine's downloads take a `&dyn Transport`. In the engine, a router sends `sftp://` links to the SFTP transport and every other link to libcurl's loop.
- **`FetchPipe`:** a transport other than libcurl writes its fetch through one, with the same events as libcurl's (a head through the gate, the body, then the end). It has the same reader's buffer, speed limits and body limit as libcurl's write callback; both use one `Sink` (`velocity-curl/src/pipe.rs`). A range's end is the body limit.
- **`file_head`:** the head an HTTP server would send for a file of a known size and time (`velocity-curl/src/head.rs`), shared by FTP and SFTP: `200`, `206` for a range, `416` past the end, `Last-Modified` from the file's time with a `Date` of now.

### A fetch

Each SFTP fetch is a task on the transport's own tokio runtime (2 worker threads):

1. **Connect,** within 30 s (as libcurl's connect timeout), to the link's host and port, 22 by default.
2. **The host key** is checked against Apollo Download Manager's known_hosts file before anything else is sent ([below](#host-keys)).
3. **Log in** as the user of the spec's `credentials`: with `sshKey` (a private key file and its passphrase) when the spec has one, otherwise with the password.
4. **`stat`** gives the file's size and modification time, which make the head. The gate decides before a byte is read.
5. **Read** from the range's start, 64 KiB at a time, through the `FetchPipe`. A full buffer waits for the reader; a speed limit without tokens is checked again every 10 ms.

Cancelling the fetch, or dropping it, ends the task at its next step.

- **One connection, one stream:** as for FTP (`DownloadOptions::one_connection`); whether more would help isn't measured. A cut or a pause resumes at its offset with one read from there.
- **The resume check:** the file's time is a strong `Last-Modified` once it is a second old, so a resume is checked against it ([changed files](ENGINE_PERSISTENCE.md#changed-files-45)). A file whose time changed starts over.

### Host keys

- **The store:** `<data folder>/known_hosts` (`Paths::known_hosts`), Apollo Download Manager's own, never `~/.ssh/known_hosts`. It is unhashed, one OpenSSH line per host (`[host]:port key-type base64-key`), and compares the whole key. A host is shown by its key's SHA-256 fingerprint (`SHA256:…`, as OpenSSH prints it). Writes go to a temporary file, then a rename.
- **Unknown key:** refused before the login. The download fails at once, permanently, and `TransferError.hostKey` carries the host, port and fingerprint for the user to check. The transport remembers that key.
- **Trusting it:** `DirectTransfer::trust_host_key(host, port, fingerprint)` pins the key the transport saw with that fingerprint, and only that one: a fingerprint it didn't see is `NotFound`. The caller then retries the download. The app's `trust_host_key` command (#58) calls it through `Manager::trust_host_key`, and the window's host-key question (#60) shows the fingerprint and calls it.
- **Changed key:** always refused, before the login. `hostKey.pinned` holds the pinned key's fingerprint. Such a key is never offered for trust, and `trust_host_key` never replaces a pinned key (`InvalidState`).
- **Host certificates** are refused: Apollo Download Manager trusts no SSH certificate authority.

### Failures

| What happened | Kind | Retried |
|---|---|---|
| The host key is unknown, or changed | Permanent, with `hostKey` | No |
| The login was refused, or there's no user name | `AccessDenied` | No |
| The private key can't be opened (a wrong passphrase, for example) | `AccessDenied` | No |
| No such file | `NotFound` | No |
| The connection was refused, or broke part way | `Connect`, `Interrupted` | Yes, from the first missing byte |
