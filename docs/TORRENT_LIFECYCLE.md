# Torrents: seeding and resume

What happens to a torrent after it's added: moving it, seeding, its resume data and recovery, deleting its files, its trackers and peers, and how the app runs torrents. Torrent settings are in [TORRENT_CONTRACT.md](TORRENT_CONTRACT.md#settings-and-identity). How torrents work is in [TORRENTS.md](TORRENTS.md); split from it by #425.

## Moving a torrent

- **When:** changing a torrent's category moves its files to that category's folder (#366, [FILE_NAMING.md](FILE_NAMING.md#categories)).
- **How:** `moveStorage` has libtorrent move them (`move_storage`, never over a taken name). The torrent keeps seeding or downloading meanwhile. `moved` follows, with the new folder, or `moveFailed`, with the files where they were. The helper then saves the torrent's resume data, which holds the folder, and the supervisor adds it back from the new folder after a crash.
- **A taken name:** when the torrent's file or folder name is taken in the new folder, the manager doesn't ask for the move. The torrent stays, and the category still changes (PO decision on #366). It is never renamed: deleting a torrent's files, adding it again and restoring it all work its paths out from its original name.

## Seeding

Seeding is off by default (ADR-0005). The policies and their limits are V1's (PO decisions on #62), and the torrent helper applies them.

- **Policies** (`seeding` in `add`, and `setSeeding`):
  - `never`: stop once complete. The default.
  - `time` (`minutes`, 1 to 525,600), `ratio` (`ratio`, 0.1 to 100), or `timeOrRatio` (both): stop at the first limit reached.
  - `unlimited`: seed until the user stops it.
  - Anything outside these ranges is refused with `INVALID_INPUT`.
- **What the limits count:** libtorrent's own seeding time and upload total over the torrent's life. The ratio is uploaded bytes over the bytes of the files downloaded. Both come back with the resume data, so a restart doesn't reset them, and a policy already met doesn't seed again.
- **The seeding queue:**
  - **The limit:** at most `maxActiveSeeds` torrents seed at once; 0, the default, means no limit, and more than 1,000 is refused (V1's limits).
  - **The order:** the torrent waiting longest starts first. When the limit is lowered, the torrents that started seeding last go back to the queue.
  - **Waiting:** a torrent in the queue is stopped, and shows as Completed with `seedQueued`.
- **Controls:**
  - `pause` and `resume` work on a seeding torrent: a resumed one goes back through the queue.
  - `setSeeding` with `never` stops it.
  - A new policy that isn't met yet makes a completed torrent seed again.
  - A torrent added paused, or paused by the user, stays paused when it completes.

## Resume data and recovery

Resume data is libtorrent's own record of a torrent: its metadata, which pieces it has, its file choice, its trackers and its seeding totals. It isn't a [checkpoint](GLOSSARY.md); the direct-download engine's checkpoints are Apollo Download Manager's own format.

- **When the helper sends it:** as `resumeData` events in chunks of at most 1 MiB, in order:
  - when libtorrent says it changed, at most every 10 s (a starting value: a crash loses at most that much of the record);
  - when the torrent completes;
  - for `saveResume`.
- **What isn't sent:** a magnet whose metadata isn't known yet has none; it is added again by its link.
- **Adding a torrent back:** `upload` sends the resume data in chunks, then `add` or `restore` with `{"kind":"resume"}` adds the torrent from it.
  - **Checks first:** the resume data comes back from storage, so `check_resume_data` checks it before libtorrent reads it:
    - only the entries libtorrent 2.0.15 writes are accepted. Never `mapped_files`, which would rename the torrent's files;
    - the metadata inside it passes `parse_metadata`, and its info hashes must match that metadata;
    - trackers and web seeds pass the tracker checks, and web seeds must be `http` or `https`;
    - the per-file priorities must match the files;
    - modes Apollo Download Manager never sets are refused: seed mode, share mode, super-seeding and I2P;
    - at most 32 MiB.
  - **What libtorrent gets:** the metadata Apollo Download Manager checked, not the copy inside the resume data.
  - **What libtorrent trusts:** the resume data's record of which pieces are done. libtorrent doesn't check the files again, as with V1.
  - **What the spec sets:** its folder, trackers, pause and policy apply. Its `files` changes the choice; without it, the resume data's choice stands. A torrent whose resume data chose nothing waits in Choosing files.
- **Where it is kept:** the supervisor keeps each torrent's latest resume data in memory, and the manager stores it in the database without its trackers ([In the app](#in-the-app-58)).
  - **Before the app closes:** the manager asks the helper for every torrent's resume data (`save_resume`) and waits up to 5 s for each fresh copy (`Manager::prepare_to_close`). The supervisor's `collect_resume_data` does the same for a caller without a manager.
- **A crashed helper:**
  - **First:** its torrents fail with a retryable error.
  - **Then:** the new helper gets each one back under its own id (`restore`): from its latest resume data, otherwise from its link or file. The choice, pause and policy set since apply. Commands for it work again.
  - **If one can't be added back:** it stays failed.
  - **The same happens** after a hang or a restart by hand (PO decision on #62).

## Deleting a torrent's files

The helper never deletes files. Deleting is the manager's decision, through `velocity_core::torrent_files` (PO decision on #62): `Manager::remove` with its files deletes, with the torrent's stored metadata, the files ever chosen, libtorrent's part file and the folders left empty.

- **Without stored metadata (#268):**
  - **A last try:** before the helper forgets the torrent, `remove` asks it for the metadata once more.
  - **If it still isn't known:** a torrent that wrote bytes reports its folder entry as kept (`Failed`), with a warning in the app's log. It's never reported deleted.
  - **The cause it fixes:** the field test found magnets' metadata often unsaved, and Delete files then deleted nothing while logging that it had.

- **What is deleted:**
  - the files ever chosen;
  - libtorrent's part file, `.<info hash>.parts`;
  - then each folder of the torrent that is left empty.

  Unchosen files are never deleted: libtorrent never writes them, so a file there of the same name is someone else's.
- **Only what is verifiably the torrent's:**
  - a plain file, no larger than the torrent says;
  - inside the torrent's folder, reached through plain folders.
  - A link, such as a symbolic link or a junction, is never followed, and neither is anything behind one ([SECURITY.md](SECURITY.md#files-and-folders-72)). The torrent's folder itself must be a plain folder.
- **Windows:** a file still open can't be deleted, so each file is tried again for up to 5 s, after the helper has removed the torrent. On the development machine, libtorrent 2.0.15 had let go of a seeding torrent's files at once: the integration test passed without the wait three times out of three. A core unit test covers the wait with a file held open without delete sharing.
- **The report:** `delete_owned` says what it deleted and what it kept, and why: a link, too large, behind a link, a folder not empty, or the error.

## Trackers and peers

- **Tracker URLs are redacted** before they leave the helper: scheme, host and port only, as V1 showed them (`torrent::redact_tracker`). A private tracker's passkey, in the path or the query, and any login never reach the app's logs or UI.
- **Untrusted text is cleaned:** a tracker's message loses control characters and the tracker's own URL, and is cut to 300 characters. A peer's client name loses control characters and is cut to 64.
- **Trackers on localhost:** libtorrent refuses to announce to them unless the path starts with `/announce` (its SSRF mitigation). Trackers elsewhere aren't affected.

## In the app (#58)

The manager runs torrents beside direct downloads, through the `TorrentEngine` contract (`manager/torrents.rs`).

- **Adding:** `Manager::add_torrent` takes a `.torrent` file's absolute path or a magnet link, the folder, extra trackers, the file choice, the seeding policy and the limits. It checks them first: the magnet with `parse_magnet`, each tracker with `check_tracker`, and the policy and limits against their bounds. Nothing is stored when one is refused. The Add dialog (#60) adds through `Manager::add_request`: duplicates by info hash, the category from the largest file, and `.torrent` links fetched into the app's `torrent-links` folder and kept there without their trackers ([CONTRACTS.md](CONTRACTS.md#adding-downloads)).
- **The queue** (PO decision on #58): a torrent takes a slot of the queue while it fetches its metadata or downloads, as in V1, where aria2 counted torrents. Choosing files, seeding and paused don't take one; seeding has its own limit, `maxActiveSeeds`.
- **What is stored** (the `torrents` table, [DATA_AND_MIGRATIONS.md](DATA_AND_MIGRATIONS.md)):
  - where it came from: the `.torrent` file's path, or the magnet link without its trackers;
  - the file choice, the seeding policy and the limits;
  - its metadata, once known and checked;
  - its resume data, without its trackers (`torrent::strip_trackers`), saved whenever the helper sends it;
  - its info hashes and upload, on its `downloads` row.
- **Tracker passkeys** (PO decision on #58): tracker addresses can carry a private tracker's passkey, so none is stored in the database, resume data, checkpoints or logs. Trackers given this session stay in memory. A torrent's trackers are kept across a restart only when the user asks, in the system keychain (#472, [ADR-0021](decisions/0021-tracker-passkeys-in-the-keychain.md)): every tracker it is known to have (given, its magnet link's, and those stripped from its resume data, where a `.torrent` file's own are), in parts of at most 1,000 characters, since a Windows keychain entry keeps at most 1,280 (`Keychain::save_trackers`). Resume data that brings a new tracker saves the list again. After a restart the torrent is added again with them; if they can't be read, its details say so. Without them, a private torrent finds peers only through the settings' extra trackers, and as before the user adds it again.
- **Starting again:** a torrent comes back from its stored resume data (uploaded in chunks, then added with `{"kind":"resume"}`), and otherwise from where it came from. A completed torrent isn't added again; a seeding one is.
- **A helper that stops:** its supervisor adds the torrents back under the same ids. A torrent it reports lost (`torrent_engine::lost_by_helper`) shows as waiting, with the reason, and keeps its slot; the manager doesn't add it again too.
- **Commands:** pause, resume, cancel (the helper forgets it and its files are kept, as in V1), retry, remove with or without its files, the download limit, `choose_files` and `set_seeding`. A torrent's connections are libtorrent's, so `set_download_connections` is `UNSUPPORTED` for one.
- **What the window asks for while it shows a torrent** (#63, [CONTRACTS.md](CONTRACTS.md#the-downloads-commands)): its details from the stored metadata (`Manager::torrent_details`); its trackers and peers from the helper, every second, only while shown (PO decision on #63); re-announcing; the upload limit; and changing its files, which deletes the files dropped only when the user asks, and only the torrent's own (`delete_owned`).
- **Adding with choices** (#63): a `.torrent` file is previewed first (`Manager::preview_torrent`), with the download it would repeat. The Add request carries the files chosen for it, the seeding policy and the upload limit. A choice made before adding replaces "Choose files before downloading".
- **A late status:** a running status the helper sent before it paused a torrent the user paused doesn't undo the pause (#63, V1 #40), as for direct downloads (#59).
- **Without a helper:** when the program can't start, the app runs with `MissingTorrentEngine`: torrents wait, and the snapshot's `torrentEngine` says why.
