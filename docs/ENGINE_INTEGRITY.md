# Engine: integrity

How the transfer engine proves the bytes it downloaded: the completion gate, checksums, piece hashes and what was proven. Part of the engine's internals ([ENGINE_INTERNALS.md](ENGINE_INTERNALS.md)); split from ENGINE_PERSISTENCE.md by #425.

## Integrity (#46)

A download is Completed only once its bytes are proven as far as the trusted hashes it has allow (report section 5.3, [`integrity.rs`](../crates/velocity-transfer/src/integrity.rs)). Hashing never runs on the network or downloader thread.

### The completion gate

In this order:

1. coverage is `[0, T)`;
2. the part file's length is T;
3. every piece matches its trusted hash, when there are piece hashes, and the whole-file hash matches the checksum, when there is one. The status is Verifying while the end of the whole-file hash is computed;
4. the part file is synced;
5. it is renamed without replacing an existing file;
6. on Unix, the folder is synced.

### The hash frontier

Hashes don't compose: the digests of separate segments can't be combined into the file's. So the frontier, on a thread of its own, hashes the covered prefix from byte 0. The part file tells it, after every write, how far the bytes from 0 reach; it reads the new ones back and hashes them. At completion it hashes whatever is left. Its state isn't saved, so after a crash or a resume it starts again from byte 0, reading back what is on disk.

- **The worst case** is one full sequential read at completion: the first segment finishes last, as when the range after the probe is the slowest.
- **A checksum is never skipped:** without a running frontier, the whole file is hashed at completion.
- **Memory:** the frontier holds one 1 MiB buffer and one number, how far it may hash; the writer never waits for it.
- **Cancel and pause while it waits:** completion waits for the frontier and for the last piece verdicts, checking every 100 ms (`CANCEL_CHECK`). A cancel ends the download and removes the part file; a pause keeps it, and a resume hashes again from byte 0. Either thread stops after its current 1 MiB read.

### Piece hashes

`TransferSpec::pieces` holds trusted hashes of fixed-size pieces, such as a Metalink file's `<pieces>` (#54 fills it; PO decision on #46). Hashes Apollo Download Manager computes itself would only catch disk errors, never wrong server content, so only trusted ones are used.

- **Checked once covered:** each piece goes to the piece verifier, on a thread of its own, as soon as its last byte is written, in every mode. The last piece ends with the file, so it goes once the total is known.
- **Re-fetched alone:** once the file is covered, the engine waits for every verdict. A bad piece is taken out of coverage, its bytes from this attempt count as wasted, and the download fetches the missing ranges again with a new scheduler built from the coverage. The range scheduler isn't changed for this, so invariants I1 to I7 hold as before.
- **At most 2 re-fetches** per piece, 3 tries in all (PO decision on #46). A third bad copy fails the download: "The downloaded file's piece n of m doesn't match its trusted hash, even after fetching it again 2 times: the server sends bad data. …".
- **Without ranges** (a single stream, or ranges lost), a piece can't come alone, so the whole file is downloaded once more as one stream (PO decision on #46). A bad piece again fails it.
- **A list that doesn't fit** the file, with more or fewer pieces than its size needs, fails at once as Permanent.
- **With a checksum as well,** the frontier starts again from byte 0 after a piece is fetched again, because it may have hashed the bad bytes.
- **Mirrors:** a bad piece is blamed on the source that sent it, and fetched again from the healthiest one ([Mirrors](ENGINE_METALINK_MIRRORS.md#mirrors-55)).

### A failed check

A wrong checksum, or a piece that stays bad, fails the download with a message and `DownloadError::IntegrityFailed`. A piece that stays bad is Transient and retryable: another try, or another mirror, may send it right. A wrong checksum is Permanent (PO decision on #274): retrying gets the same bytes unless they were damaged on the way, so its message says to check the checksum first, and a retry by hand still downloads the file again. Either way:

- the part file is **kept** for inspection, and not renamed;
- the engine **doesn't start it again** on its own, as that would replace the part file;
- when checkpoints were sent, a last one follows that **trusts no byte**, so a resume from it downloads the whole file again instead of checking the same bytes a second time (report section 5.3: "A retry re-downloads once").

A piece list that doesn't fit the file fails the same way, but as Permanent: the list or the server is wrong.

### What was proven

`DownloadReport::verification` and the snapshot's `verification` say what the completed file's bytes were checked against ([ADR-0010](decisions/0010-resume-without-validator.md)):

| Verification | When |
|---|---|
| `verified` | A checksum or trusted piece hashes were given, and they matched |
| `notVerified` | No hash, and the download resumed from bytes on disk without a strong validator, so a file that changed at the same length could have mixed two versions |
| `sizeVerified` | Anything else complete: every byte arrived and the length matched |

"Verified" is shown only when a hash was checked. The manager saves the value (`downloads.verification`, #58).

### Read-back cost

Measured with [`examples/hash_readback.rs`](../crates/velocity-transfer/examples/hash_readback.rs) (the issue's risk; #46, 2026-10-23) on Windows 11 with an Intel Core i7-13620H (16 threads, 16 GB). A 1 GiB file is written in 1 MiB chunks to a part file, and the frontier follows. Medians of 3 runs, in seconds:

| Algorithm | Hash alone, from memory | Completion waits, segments in reverse (worst case) | Completion waits, segments in order |
|---|---|---|---|
| MD5 | 2.89 | 3.20 | 3.04 |
| SHA-1 | 0.91 | 1.18 | 1.16 |
| SHA-256 | 1.35 | 1.60 | 1.34 |
| SHA-512 | 3.30 | 3.40 | 3.52 |

What they show, and what they don't:

- **The hash itself is most of the cost.** Reading back the whole file adds 0.1 to 0.3 s per GiB here, because the file was just written and the read comes from the operating system's cache. A read from the disk itself would take longer; it isn't measured.
- **In order isn't faster here,** because the example writes from memory far faster than the hash runs, so the frontier is still behind when the last byte lands. A download slower than the hash, as from a network, keeps it nearly caught up; that isn't measured either.
- **SHA-1 and SHA-256 are faster than MD5 on this CPU,** which has SHA instructions that RustCrypto uses.
- **Single runs vary:** the slowest of the three was up to 1.4 times the median.

Run it with `cargo run --release -p velocity-transfer --example hash_readback -- [dir] [--mib N] [--runs R] [--algorithms md5,sha1,sha256,sha512]`. The numbers above were taken with `--config profile.release.debug-assertions=true`, which the examples needed until the HTTP/2 tests moved out of `velocity-transfer` (below); debug assertions don't touch the hashing code.
