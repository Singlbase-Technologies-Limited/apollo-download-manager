# Engine: persistence and integrity

How the transfer engine saves progress, notices a file that changed on the server, and proves what it downloaded. Part of the engine's internals, with [ENGINE_INTERNALS.md](ENGINE_INTERNALS.md) (protocols), [ENGINE_SCHEDULER.md](ENGINE_SCHEDULER.md) (scheduler and connections) and [ENGINE_TESTS.md](ENGINE_TESTS.md) (its tests); split from ENGINE_INTERNALS.md by #425.

Integrity checks are in [ENGINE_INTEGRITY.md](ENGINE_INTEGRITY.md).

## Changed files (#45)

Every answer after the first must be about the file the first answer described (report section 5.3, [`validator.rs`](../crates/velocity-transfer/src/validator.rs)). Validators belong to the file, not to its URL, so an answer that a redirect brought from elsewhere is held to the same.

### The validator

| The first answer gives | Sent as `If-Range` on every later range request |
|---|---|
| A strong ETag, such as `"v1"` | The ETag |
| A weak ETag, such as `W/"v1"`, with or without a Last-Modified | Nothing. RFC 9110 §13.1.5 forbids a weak tag in `If-Range`, and a date while an entity tag exists |
| No ETag, and a Last-Modified at least 1 s before the answer's own `Date` | The date. 1 s is RFC 9110 §8.8.2.2's rule for a client (`STRONG_DATE_MARGIN`); the report keeps a larger margin as a hypothesis to test |
| Anything else, a malformed ETag included | Nothing. Only the total is compared, and a resume follows [ADR-0010](decisions/0010-resume-without-validator.md) |

The report's fixture table says a weak ETag still allows a strong Last-Modified. The RFC's text doesn't, and the engine follows the RFC.

### What every later answer is checked for

In the header callback, before any byte is written, an answer is about another file if it has:

- **another ETag,** compared as sent, so a weak tag never equals a strong one, or **no ETag** where the first answer had one (the report's conservative rule);
- **another strong date,** or none;
- **another total,** or a `416` for a range inside the old total;
- **another `Content-Encoding`,** which is its own case below.

A `200` to a range that carried `If-Range` is the new file when its validators differ (RFC 9110 §13.1.5), and ranges lost when they match. The same checks apply to the stream that fills the gaps after ranges are lost, and to a probe asked for again after it was cut off, whose bytes so far are the earlier answer's. That retry must also give the same length.

### What a change does

- **Another file:** every request stops, the part file is emptied, and the download starts over once from a new probe, which gives the new validator. Old and new bytes are never mixed. A resume whose file changed since its checkpoint does the same.
- **Another encoding:** ranges count encoded bytes, so the download starts over once as one stream (`Mode::SingleStream`).
- **A second change** after the start-over ends the download: "The file changed on the server during download, twice: …". It is Transient and retryable, so the user can retry it, but the engine doesn't restart it on its own. The part file is deleted.

The start-over uses a new scheduler and a new probe, not `Scheduler::new_epoch`, because the new file's total and validator come from the new probe.

### Content encoding

A server may apply an encoding nobody asked for, such as a `.tar.gz` served with `Content-Encoding: gzip`. The engine stores the bytes exactly as sent and never decodes them (PO decision on #45, replacing #41's refusal). Ranges work while every answer has the same encoding, which the checkpoint records (`contentEncoding`) so that a resume can check it. The rare cost: a file that a server compressed on the fly is saved compressed.

### Expired links

A `403` on any answer after the first fails with "The download link expired. Get a fresh link from the browser." (PO decision on #45: a message, with no new failure kind). A `403` on the first answer keeps "The server denied access to the file. The link may have expired.", as it may be a real refusal.

### What can't be detected

A server that changes the file but keeps its ETag, its date and its length looks unchanged. Only a checksum catches it ([integrity](ENGINE_INTEGRITY.md#integrity-46)). Without any validator, only the total is compared ([ADR-0010](decisions/0010-resume-without-validator.md)).

## Persistence and recovery (#43)

A download survives a pause, an app restart, an engine crash and a power loss without a corrupt or falsely finished file. The rules are in the [persistence rule](../.claude/rules/persistence.md); the PO decisions are on #43.

### Checkpoints

- **When:** every 2 s or 16 MiB, whichever comes first (`Cadence::DEFAULT`, the report's starting values). Also when a download is paused. The probe takes them too once its answer has given the file's total, because the probe can be the whole download.
- **How, in this order:**
  1. the part file is synced (`sync_data`);
  2. the scheduler marks what is covered as durable (D);
  3. the checkpoint is sent.

  A byte is in D only once it is on disk (invariant I5).
- **What it holds** (`Checkpoint`, [ENGINE_CONTRACT.md](ENGINE_CONTRACT.md)):
  - a format version (`CHECKPOINT_FORMAT`);
  - the source without its login, query and fragment, so no token;
  - the total;
  - what the first answer said about the file: its ETag, its Last-Modified only when that was the strong validator, and its `Content-Encoding` ([changed files](#changed-files-45));
  - D as half-open byte ranges.

  Leases are never saved.
- **Where it goes:** the engine sends it as a `checkpoint` event over its pipe. The app saves it in its database (the `checkpoints` table, [DATA_AND_MIGRATIONS.md](DATA_AND_MIGRATIONS.md)); only the app touches the database (PO decision). The manager saves it, drops it once the download completes or is removed, and resumes from it when the app starts again or the engine was lost ([ENGINE_CONTRACT.md](ENGINE_CONTRACT.md#saving-and-starting-again-58)).
- **Only ranges resume.** A single stream (a server without ranges) and a download without a total (sequential ranges) take no checkpoint, because nothing could resume them. Pausing them keeps the part file, and resuming starts over.

### Resuming

The app hands back what it saved, in `TransferSpec::resume`:

| `resume` | The engine |
|---|---|
| `checkpoint` | Trusts the checkpoint only if it fits: this format, this download's source, and ranges that are sorted, disjoint, non-empty and inside the total. If it fits, the part file is reopened (never through a link), only D is trusted, and only the rest is fetched, with the recorded validator in `If-Range`. Another validator, total or encoding, or a `416` inside the old total, means the file on the server changed: the old bytes are discarded and the download [starts over once](#what-a-change-does). If it doesn't fit, or the part file is gone, the download starts over |
| `newLink` | As `checkpoint`, with a new link the user gave for the same file (#466). The manager writes the checkpoint for the new link without the old tags, so it continues on the size alone and ends "not verified" (ADR-0010). A file of another size isn't started over: the download fails as permanent ("The new link is for another file…"), and the part file is kept |
| `discardPartFile` | The part file is the download's own but has no usable checkpoint: it is deleted and the download starts over (PO decision). A link, or anything that isn't a plain file, is refused and never touched |
| none | A new download. An existing part file is never reused: the download fails |

A resumed download's progress counts the bytes it holds: D plus what arrived since, not only the new bytes (#257). So the list shows where it really is from its first report, and progress never drops after a pause, a crash or an engine restart, unless the download started over. Before that first report, a transfer added with a checkpoint is queued with D's bytes and the file's size (`TransferSnapshot::queued`, used by the engine and its supervisor), not "0 B of unknown size".

**A start-over is never silent (#257).**
- **What's reported:** each time a download drops bytes it had, the engine sets the snapshot's `startedOver` to why. The details panel shows the sentence, and the app's log has a warning line: `download <id> started over: <why>`.
- **A start that drops nothing isn't reported:** for example a fresh download, or a mirror hand-over before any byte was written.
- **The reasons** are in `download::started_over`:

| Why | Sentence |
| --- | --- |
| [Another file](#what-a-change-does) (a changed validator or size) | "The file on the server changed, so the download started again." |
| Another encoding | "The server changed how it sends the file, so the download started again." |
| A checkpoint that isn't trusted (above) | "The saved progress couldn't be used, so the download started again." |
| `discardPartFile`, with a non-empty part file | "There was no saved progress for the unfinished file, so the download started again." |
| A checkpoint whose part file is gone | "The unfinished file was gone, so the download started again." |
| A bad piece from a server without ranges ([integrity](ENGINE_INTEGRITY.md#piece-hashes)) | "Part of the file failed its check, and the server can't send parts alone, so the download started again." |
| The first source failing after it wrote bytes ([mirrors](ENGINE_METALINK_MIRRORS.md#when-a-source-fails)) | "The first source failed, so the download started again from another." |

A strong validator that differs from the one the download started with always means another file, even at the same size: the download starts over once and says so, and a second change fails it. Two versions are never mixed (PO decision on #257, 2026-11-03).

`StoredDownload::resume` in the database layer makes the choice from a record and its saved checkpoint. It picks the checkpoint if it's known and of this record's source, `discardPartFile` otherwise, and nothing for a finished record. A record this build can't route is never resumed.

### Pausing, stopping and crashing

- **Pause:** the requests stop, a last checkpoint is taken, and the part file stays. **Resume** starts a new worker from that checkpoint. Cancelling a paused transfer deletes its part file.
- **When the app goes away,** or closes the engine's pipe, the engine pauses every transfer and keeps their part files, so the app can resume them when it starts again. It no longer cancels them, as #39 did.
- **A failure:** one worth retrying, after a checkpoint was taken or when the start resumed from one (#317), keeps the part file, and the engine starts the download again from that checkpoint ([the whole download](ENGINE_RETRIES_LIMITS.md#the-whole-download)). Any other failure deletes it.
- **A crash** (`kill -9`, a power loss) leaves the part file and the last checkpoint the app saved. Nothing that looks finished exists until the rename.

### Finishing

The file is renamed into place only when coverage is complete and, with a checksum, the hash matches ([the completion gate](ENGINE_INTEGRITY.md#the-completion-gate)):

1. the part file is sized, checked and synced;
2. it is renamed **without ever replacing** an existing file. On Windows that's `MoveFileExW` without `MOVEFILE_REPLACE_EXISTING`, and with `MOVEFILE_WRITE_THROUGH`. On Linux it's `renameat2(RENAME_NOREPLACE)`, then a sync of the folder, so the new name survives a power loss.

A file that appeared at the destination during the download is kept, and the download fails with `FileExists`. On a Linux file system without `RENAME_NOREPLACE`, a hard link does the same job. The rename, unlike #37's hard link, also works on FAT32 and exFAT drives.

### Part files

[`files.rs`](../crates/velocity-transfer/src/files.rs) holds the only operations on part files:

- **Creating one:** exclusively, never over an existing name and never through a link. It's marked sparse on Windows (`FSCTL_SET_SPARSE`), so NTFS doesn't zero-fill the gap in front of a segment (see below).
- **Reopening one:** without following a link, checked again on the open handle.
- **Deleting one:** only if it's a plain file, never a link.
- **The no-replace rename:** described above.

The calls go through `windows-sys` and `libc` (PO decision), each `unsafe` call with its `SAFETY` note. `DownloadReport::sparse` says whether this run's part file was made sparse. A file system without sparse files, such as FAT or exFAT, still works, only slower.

## Disk writes far into a new file (Windows)

Segments are written in parallel, so a later segment writes far past what is already in the part file. Measured with [`crates/velocity-transfer/examples/high_offset_write.rs`](../crates/velocity-transfer/examples/high_offset_write.rs) (report open question 7; #42, 2026-10-23). It writes 1 MiB into a new file and syncs it, 3 runs each:

| Machine | Offset of the write | No preallocation | After `set_len` | At offset 0 |
|---|---|---|---|---|
| Windows 11 (build 26200), NTFS, the system temp folder | 1 GiB | 0.6, 67 and 35 s | 4.5, 61 and 32 s | 0.4–0.5 ms |
| | 4 GiB | 120, 158 and 92 s | 128, 122 and 82 s | 0.4–0.5 ms |
| WSL2 Ubuntu 24.04, ext4 | 1 GiB and 4 GiB | 0.5–1.0 ms | 0.5 ms | 0.5 ms |

- **What happens:** NTFS zero-fills the whole gap before the write returns, here at about 30 to 50 MB/s. `set_len` doesn't help, because it doesn't move NTFS's valid data length. ext4 leaves the gap empty.
- **The effect, before #43:** a multi-GB parallel download on Windows could stall for minutes on a later segment's first write. The occasional 10 to 18 s runs of the fixture tests on Windows were likely the same effect, on a 128 MiB file.
- **The fix (#43, PO decision on #42):** the part file is sparse on Windows, so the gap is never filled.

**After #43**, on the same Windows machine (2026-10-23, `--only sparse,at_zero`, 3 runs each), the 1 MiB write into a part file as the engine creates it:

| Offset of the write | Sparse part file: write | Write and sync | At offset 0: write and sync |
|---|---|---|---|
| 1 GiB | 0.4–0.6 ms | 1.8–2.2 ms | 1.8–4.7 ms |
| 4 GiB | 0.5–0.7 ms | 2.0–7.2 ms | 1.7–2.1 ms |
| 16 GiB | 0.5–0.7 ms | 1.7–10.6 ms | 1.7–1.9 ms |

The gap is no longer filled: a write far into a sparse part file costs what a write at its start does. On a file system without sparse files (FAT, exFAT), the zero-fill remains.

Run it with `cargo run --release -p velocity-transfer --example high_offset_write -- [dir] [--gib N] [--runs R] [--only no_prealloc,set_len,sparse,at_zero]`.
