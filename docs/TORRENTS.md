# Torrents

Apollo Download Manager downloads BitTorrent v1, v2 and hybrid torrents with libtorrent 2.0.15 ([ADR-0001](decisions/0001-v2-direction.md), [ADR-0005](decisions/0005-v1-features-without-aria2.md)). This document describes how torrents work in Apollo Download Manager today. #62 delivered the port in four parts: the bridge and helper, magnets and file choice, the lifecycle and seeding, and trackers and port mapping.

Seeding, resume data, moving and deleting a torrent, trackers and how the app runs torrents are in [TORRENT_LIFECYCLE.md](TORRENT_LIFECYCLE.md).

The contract with the torrent helper is in [TORRENT_CONTRACT.md](TORRENT_CONTRACT.md).

See also, for users: [Torrents](user/torrents.md).

## Where the code is

| Part | Crate | Role |
|---|---|---|
| The bridge | [`crates/velocity-lt`](../crates/velocity-lt) | A small C++ shim (cxx) over one libtorrent session. The only crate that calls libtorrent ([ADR-0002](decisions/0002-engine-crate-layout.md)). It never deletes files |
| The torrent engine and helper | [`crates/velocity-torrent`](../crates/velocity-torrent) | What reaches libtorrent and what its state means; the helper program `velocity-torrent serve`, its client and its supervisor |
| Parsing and checks | [`crates/velocity-core/src/torrent.rs`](../crates/velocity-core/src/torrent.rs) | `.torrent` files, magnet links and resume data, checked before libtorrent sees them |
| Seeding rules | [`crates/velocity-core/src/seeding.rs`](../crates/velocity-core/src/seeding.rs) | Seeding policies, when seeding ends, and the seeding queue |
| Deleting files | [`crates/velocity-core/src/torrent_files.rs`](../crates/velocity-core/src/torrent_files.rs) | Which files a torrent owns, and deleting only those |
| The contract | [`crates/velocity-core/src/torrent_engine.rs`](../crates/velocity-core/src/torrent_engine.rs) | `TorrentEngine`, the commands, replies and events |
| Torrents in the manager | [`crates/velocity-core/src/manager/torrents.rs`](../crates/velocity-core/src/manager/torrents.rs) | Adding, queueing, storing and restoring torrents, and deleting their files ([In the app](TORRENT_LIFECYCLE.md#in-the-app-58)) |

libtorrent runs in the **torrent helper**, a child process the app starts and supervises. A crash in libtorrent therefore ends only the helper ([ADR-0014](decisions/0014-torrent-helper-child-process.md)). The helper speaks the same protocol as the direct-download engine, and the same supervisor restarts it ([ENGINE_PROTOCOL.md](ENGINE_PROTOCOL.md)). The app starts it from beside its own executable (#58). The app depends on `velocity-torrent` without its `engine` feature, so it gets the helper's client and supervisor and never links libtorrent; only the helper program turns the feature on (PO decision on #58).

**Offline until the first torrent** (#521, PO decision): the helper starts its libtorrent session with no listen interface and with DHT, local peer discovery and port mapping off (`offline` in [`crates/velocity-torrent/src/engine.rs`](../crates/velocity-torrent/src/engine.rs)). libtorrent then disables networking, and looks up no DHT bootstrap name. The first torrent added or restored switches the settings' networking on, and it stays on until the helper stops; a settings or proxy change before that keeps it off. Measured on Windows 11, 60 seconds after a start with no torrent: before, the helper listened on port 6891 (TCP and UDP) on every interface; after, it has no UDP socket and no TCP socket but its loopback link to the app. Tested in `the_helper_listens_nowhere_until_a_torrent_is_added` ([`crates/velocity-torrent/tests/network.rs`](../crates/velocity-torrent/tests/network.rs)).

How libtorrent, Boost and OpenSSL are built is in [BUILDING_LIBTORRENT.md](BUILDING_LIBTORRENT.md#libtorrent).

## Checks before libtorrent

Torrent metadata and magnet links are untrusted input. `velocity_core::torrent` checks them, and the helper checks them again before calling libtorrent.

- **Bounds:**
  - **The file:** at most 16 MiB, read only up to that size.
  - **The structure:** at most 100,000 files, 64 levels of nesting, 2,000,000 bencode entries, and 64 path parts per file.
  - **Trackers:** at most 64, each up to 2,048 bytes.
  - **Errors:** the parser never panics on malformed input.
- **Hashes:**
  - **Info hashes:** the v1 hash (SHA-1) and the v2 hash (SHA-256) are computed over the info dictionary's exact bytes. A v2-only torrent never gets a made-up v1 hash.
  - **v2 piece layers:** each must match its file's Merkle root.
  - **Hybrids:** a hybrid's v1 and v2 file lists must describe the same files.
- **Names:**
  - **The rule:** every file and folder name follows `naming::check_file_name_in_folder`. That is Apollo Download Manager's file-name rule, except that a name may start with a dot, such as `.gitignore`, `.nfo` or a hybrid's `.pad` entries (PO decision on #62).
  - **What it refuses:** `.` and `..`, separators, control characters, Windows device names, and names Windows can't store (`? * < > |`, a trailing dot). Refusing them means the names on disk are always the torrent's own. V1 refused fewer names.
  - **Duplicates:** two paths that differ only in case, or one name used for both a file and a folder, are refused.
- **Magnets:**
  - **Hashes:** v1 (`urn:btih:`, 40 hexadecimal or 32 base32 characters) and v2 (`urn:btmh:1220…`) are accepted. Two different hashes of one kind are refused.
  - **What reaches libtorrent:** only the canonical form: the hashes, the display name and the trackers. Other parameters, such as `x.pe` peer addresses, are dropped.
- **Trackers:** `http`, `https` or `udp` with a host, and no spaces or control characters. Others are dropped from a torrent, and refused when given with `add`.
- **Folders:** a torrent's folder must be an existing absolute folder, not a link.
- **A magnet's metadata** comes from peers. Every magnet is added wanting nothing, so libtorrent fetches its metadata and writes no file. When the metadata arrives, the helper checks it with the core's `parse_metadata`, with every rule above:
  - **If it passes:** the metadata-only torrent is removed and added again from the checked metadata, as an ordinary torrent with its files wanted, as V1 did. The torrent then waits in Choosing files if the user is to choose them.
  - **If it fails:** the torrent fails with the reason, before any byte of it is written. libtorrent alone would rename unsafe names and download anyway.

## File choice

- **When:** a torrent added with `chooseFiles` downloads nothing and waits in **Choosing files**: a magnet once its metadata is checked, a `.torrent` file at once. A `.torrent` file can instead be added with its first choice in `files`.
- **Choosing:** `setFiles` names the files to download by their index in the torrent (`TorrentFile::index`, libtorrent's index plus one). Padding files can never be chosen. An empty choice, a duplicate or an index the torrent hasn't is refused (`INVALID_INPUT`), and so is a choice before the metadata is known (`INVALID_STATE`).
- **Changing the choice:** choosing again adds or drops files while the torrent downloads. A completed torrent that gets more files downloads them and completes again. Dropping a file never deletes what is on disk.
- **Peers:** a torrent that wanted nothing, or completed and stopped, has dropped its peers. Leaving Choosing files, or getting more files after completing, removes it from the session and adds it again with the new choice, so it finds peers as a new torrent does, and libtorrent checks the files already on disk. In the tests, without this a torrent waited longer than 120 s for peers.
- **Libtorrent's part file:** in a v1 or hybrid torrent a piece can span two files. When only one of them is chosen, libtorrent keeps the other file's part of that piece in a file of its own, `.<info hash>.parts`, in the torrent's folder, never in the unchosen file.
- **Progress:** with only some files chosen, progress is the chosen files' bytes, from libtorrent's per-file progress. libtorrent's own count is in whole pieces.
- **The metadata:** `metadata` returns a torrent's metadata (`d4:info…e`) in chunks of at most 1 MiB, as hex, because metadata may be up to 16 MiB and a message at most 4 MiB. The manager joins the chunks once the metadata is known, checks them with `parse_metadata` and against each info hash the helper reports, and keeps them ([In the app](TORRENT_LIFECYCLE.md#in-the-app-58)).
  - **Hashes:** only the hashes the helper reports are compared. A hybrid torrent's magnet gives one hash first.
  - **Retries:** just after the metadata arrives the helper can't always give it, so the manager asks again on each snapshot, up to 10 times, then warns in the app's log (#268). The resume data holds the metadata too ([Resume data](TORRENT_LIFECYCLE.md#resume-data-and-recovery)).

## Not yet

- **Trackers of torrents added before #472** can't be remembered: they were never kept. Add such a torrent again once.

## Tests

| What | Where |
|---|---|
| Real transfers between two libtorrent sessions on loopback, for v1, v2-only and hybrid, single and multi-file; a v2 magnet's metadata; bad input and duplicates | `velocity-lt` `tests/transfer.rs` (V1's 5 bridge tests) |
| Parsing, hashes, piece layers, names, limits, magnets, trackers, against hand-built torrents and the corpus | `velocity-core` `torrent.rs` unit tests |
| How libtorrent states map to Apollo DM statuses; the folder and file checks; the peer-id prefix | `velocity-torrent` `engine.rs` unit tests |
| The helper as a child process: a v1, a v2-only and a hybrid torrent and a v2 magnet downloaded from a seeder found through a loopback tracker; refused input; pause, resume and remove; a crash and its restart | `velocity-torrent` `tests/helper.rs` |
| File choice through the helper: a magnet waiting in Choosing files without writing anything, its metadata in chunks, only the chosen files downloaded and one more after completing; a `.torrent` file's first choice; unsafe metadata from a peer failing the torrent before any write; every refused choice | `velocity-torrent` `tests/helper.rs` |
| A crashed helper's torrents failing, then coming back under their ids | `velocity-torrent` `tests/helper.rs` |
| Seeding through the helper, with libtorrent sessions on loopback as downloaders: stopping at a share ratio; the seeding queue and a lowered limit; pausing, resuming and stopping unlimited seeding; refused policies and limits | `velocity-torrent` `tests/lifecycle.rs` (V1's seeding tests) |
| Resume data through the helper: a new helper continuing a torrent with its choice and without a duplicate; a paused torrent staying paused; seeding totals surviving; a magnet coming back with its metadata; a crashed helper's seeding torrent coming back; refused uploads and resume data; ids never given twice | `velocity-torrent` `tests/lifecycle.rs` (V1's restart and crash tests) |
| An active torrent's files deleted once the helper lets go, and nothing else | `velocity-torrent` `tests/lifecycle.rs` |
| Policies, their limits, when seeding ends, and the seeding queue | `velocity-core` `seeding.rs` unit tests (V1's policy and queue tests) |
| Resume data checks, each refusal for its own reason | `velocity-core` `torrent.rs` unit tests |
| Owned paths, and deleting only them: links, junctions, sizes, folders left with other files, and waiting for an open file on Windows | `velocity-core` `torrent_files.rs` unit tests (V1's owned-paths and deletion tests) |
| Resume data put back together from its chunks | `velocity-torrent` `supervisor.rs` unit tests |
| A torrent's download and upload limits holding back a peer, and the global limits not holding back a local one; a failing tracker shown redacted with its reason, and a re-announce recovering; the peers list; extra trackers; the listening port | `velocity-torrent` `tests/network.rs` (V1's limits and tracker tests). A taken port is checked on Linux |
| The session's settings; trackers and peers shown, redacted and cleaned; one free port for a random one, free for TCP and UDP (#438) | `velocity-torrent` `engine.rs` unit tests |
| The port-mapping state | `velocity-torrent` `portmap.rs` unit tests (V1's) |
| Tracker URLs redacted | `velocity-core` `torrent.rs` unit tests |
| Trackers taken out of resume data before it is stored | `velocity-core` `torrent.rs` unit tests |
| The manager's torrents against a fake helper: adding, the queue's slots, events, metadata and resume data stored, file choice, policy and limits, pause, resume and cancel, a lost torrent waiting, restoring from resume data or the origin, deleting files, closing, no helper | `velocity-core` `manager/tests.rs` (`torrents`) |
| The manager with a real helper: a torrent downloaded with its metadata and resume data kept without trackers; seeding again from resume data after the app starts again; back on its own after the helper is killed; removed with only its own files; a hybrid magnet removed with its files, three times (#268) | `velocity-torrent` `tests/manager.rs` |

- **Isolation:** the tests never leave the machine. DHT, peer exchange, local peer discovery and port mapping are off, and peers are found through a tracker on 127.0.0.1, or connect to the helper's port. Port mapping is tested by its unit tests and the session's settings only: turned on, it would send UPnP and NAT-PMP requests to the network. For seeding, the test tracker answers each peer with every other peer that announced to it; never with the peer itself, since libtorrent keeps one entry per address by default and every peer is on 127.0.0.1.
- **The corpus:** [`tests/fixtures/torrents`](../tests/fixtures/torrents) comes from V1. [`scripts/make-torrent-corpus.py`](../scripts/make-torrent-corpus.py) generated it with libtorrent's own torrent creator (2.0.10, through its Python bindings). Running the script again needs those bindings; the committed files don't.
