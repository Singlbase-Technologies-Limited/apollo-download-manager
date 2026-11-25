# Engine: Metalink and mirrors

How the transfer engine reads Metalink files and shares one file between mirrors. Part of the engine's internals ([ENGINE_INTERNALS.md](ENGINE_INTERNALS.md)); split from it by #425.

## Metalink (#54)

A Metalink document lists files with their sources, hashes and piece hashes: Metalink 4 (RFC 5854, `.meta4`) or Metalink 3 (metalinker.org 3.0, `.metalink`). libcurl dropped Metalink in 7.78.0, so Apollo Download Manager reads it itself. The manager does the reading, in `velocity-core` (`metalink.rs`); the engine only downloads the files, with the hashes it already checks (#46). Metalink is off until the user turns it on, as V1's `advanced.enable_metalink` (ADR-0005); the setting is stored and shown by #30.

### Reading a document

- **The parser** is quick-xml (PO decision on #54), read as a stream. Its limits are in [SECURITY_NETWORK.md](SECURITY_NETWORK.md#metalink-54).
- **Per file:** its name, which may hold subfolders (`disc/image.iso`); its size; the strongest whole-file hash of MD5, SHA-1, SHA-224, SHA-256, SHA-384 and SHA-512; the strongest piece list, which must fit the size; and its sources.
- **Sources:** `http`, `https`, `ftp` and `ftps` URLs without a login, best first. Metalink 4's lower `priority` comes first and Metalink 3's higher `preference`; unranked ones come last, in document order. A duplicate counts once. SFTP sources are dropped (a document can't supply a login or confirm a host key), as are torrents (`metaurl`, a Metalink 3 `bittorrent` resource; a non-goal of #54).
- **A file with no usable source** is skipped and counted (`Metalink::skipped`), and a document with none at all is refused.
- **Announced mirrors** (#324): the probe reads Metalink/HTTP's `Link: <…>; rel=duplicate` headers (RFC 6249), resolves each against the file's address, checks it as the app checks a mirror ([`mirrors.rs`](../crates/velocity-core/src/mirrors.rs): `http`, `https` or `ftp`, a host, no login, not a Tor address, not the link itself), orders them by `pri`, and reports them in the snapshot's `announcedMirrors`. The engine never uses one by itself: the user chooses ([Mirrors the user chooses](#mirrors-the-user-chooses-324)). The `Digest` header is still not read.

### Adding its files

`Manager::add_metalink` adds the selected files, all of them unless a selection names some, one download each with kind `metalink`:

- **The folder:** each file goes into its subfolders inside the chosen folder (PO decision on #54: kept, as V1 did). They're created one level at a time. A folder already there is used, but a file or a link (a symbolic link, or on Windows a junction or mount point; [SECURITY.md](SECURITY.md#files-and-folders-72)) in the way is refused, never followed.
- **The download:** its sources the engine can fetch, best first, in `TransferSpec::urls`; its hash in `checksum` and its piece list in `pieces`; its name in `fileName`. No login, headers or referrer: a document's sources are other servers.
- **All or nothing:** a file with no source the engine supports refuses the lot before anything is added. A file the engine refuses after others were added takes those back (they're cancelled), and the refusal is the error.
- **A local file:** `metalink::read_file` reads a `.metalink` or `.meta4` file, as V1's `validate_local_metadata_file` did: an absolute path to a plain file, never a link. **Not wired:** no command calls it, so the app can't add a local Metalink file yet; Metalink downloads come only from links.

### Following a link

As aria2's `follow-metalink` did for V1: while Metalink is on, a completed HTTP or FTP download that is a Metalink file adds every file it lists, into its own folder.

- **How it's known:** its name ends `.meta4` or `.metalink`, or the server called it `application/metalink4+xml` or `application/metalink+xml` (`TransferSnapshot::content_type`, `contentType` on the wire, contract 11).
- **The Metalink file stays** on disk as a completed download.
- **One that can't be used** fails, with the reason: "Apollo Download Manager downloaded this Metalink file but couldn't add its files: …". The file is kept.
- **Never twice:** a download that came from a Metalink is never followed, so one document can't chain to another.

## Mirrors (#55)

A download can have several sources: its URL and its mirrors, such as a Metalink file's (#54), in `TransferSpec::urls`, best first. Several are used at once, as V1's aria2 did (`uri-selector=feedback`; PO decision on #55). `download::download_from` takes them; [`crates/velocity-transfer/src/sources.rs`](../crates/velocity-transfer/src/sources.rs) keeps each one's health. A download with one URL takes exactly the path it took before.

### Which sources may share a file

Bytes from two sources are mixed only when they are proven to be the same file. A mirror's first answer to a range decides; until then it serves nothing (`sources::admission`, checked in the request's header callback before a byte is written):

- **Always:** the same total and the same `Content-Encoding` as the download's first answer. Another total or encoding disables the mirror for this download.
- **With trusted piece hashes:** that is enough. Every piece is checked as it is covered, so a mirror that sends other bytes is caught (below).
- **Without them:** it must also give the same strong validator (an entity tag, or a strong date) as the first answer. A mirror that doesn't is *unproven*: it serves no range, and is kept only as a fallback.
- **After that,** each mirror is held to its own first answer, as the first source is (#45), with its own `If-Range`.
- **Only HTTP and HTTPS** sources share. FTP and SFTP run on one connection (#51, #53), so they are only ever a fallback; a download whose first source is FTP or SFTP uses one source at a time.

### Who gets the next range

For each new request the pool picks a usable source that isn't cooling down and has room (at most the download's connections each):

1. One never asked yet goes first, once, so its speed gets measured.
2. Otherwise the one with the most speed to spare: its measured speed (bytes over the time its requests were busy) divided by its open requests plus one, halved for each failure. A source tried but not yet measured counts as fast as the fastest measured one. Ties go to the earlier source.

So two equal mirrors share a file about evenly, and one twice as fast takes about two thirds of the requests. With mirrors and piece hashes, the probe and every lease end on a piece boundary, so each piece comes from one source.

### When a source fails

- **A mirror's failure is the mirror's,** never the download's: a refused or reset connection, an error status, a cut-off or short answer, a `200` for a range, or an answer whose file changed. Its range is leased again, at once, from another source.
- **A transient failure** cools the source down for 2 s, doubled for each further one (`sources::COOLDOWN`); the third disables it for the download (`MAX_FAILURES`). A permanent one, such as a `404`, disables it at once. Both are starting values for #77 to measure.
- **A bad piece** is blamed on the source that sent it (`Sources::blame`): its standing halves and it cools down, and a second bad piece disables it. The piece is fetched again, from the healthiest source. When a piece came from several sources, which can only happen when a cut-off lease's rest went elsewhere, each gets an ordinary failure instead.
- **The first source** failing its probe, or every proven source failing, hands the download to the next source that isn't disabled. The download then starts over from it, since nothing proved its bytes the same, and the others must prove themselves against it again (`Sources::make_lead`).
- **None left:** the download fails with "Every source of the download failed; the last: …", and that failure's class decides whether the engine retries it.

### What a mirror is sent

The user agent and the referrer go to every source. The login and custom headers go only to the first URL's origin (#40), so a mirror elsewhere never sees them ([SECURITY_NETWORK.md](SECURITY_NETWORK.md#mirrors-55)). The engine checks every URL in the spec as it checks the first: one it may not fetch refuses the download.

### Mirrors the user chooses (#324)

Besides a Metalink file's sources, a download's further sources are the mirrors the user chose (PO decisions on #324), at most 8, after its own link, in `TransferSpec.urls`:

- **Where they come from:** the ones the file's server announced (above), and the ones a project's official list has. [`mirrors.rs`](../crates/velocity-core/src/mirrors.rs) knows eight projects' lists by the link's server: Ubuntu (Launchpad's CD-mirror feed), Debian (its CD mirror page), Fedora (MirrorManager's list for the file's path), Apache (`closer.lua`, which names only its CDN), Arch Linux (the mirror status JSON, active mirrors with ISOs, best score first), Linux Mint (its download mirrors page), openSUSE (the file's `.meta4`) and GNU (its mirror page, without the alpha and special mirrors). The three HTML pages are read with `dom_query` (PO decision on #324). Each list's reader is tested on a trimmed copy of the real list ([`tests/fixtures/mirrors/`](../tests/fixtures/mirrors/)).
- **Fetched only on a click:** the manager fetches the list through the engine into the app's own folder, as a `.torrent` link (#60): no queue slot, at most 4 MiB, deleted once read, 30 seconds at most ([`manager/mirrors.rs`](../crates/velocity-core/src/manager/mirrors.rs)).
- **Admitted as any source** (above): a mirror is used only once it answers with the same file.
- **Changed while not running:** a paused or failed download lets the engine go of its transfer and continues from its checkpoint with the new sources; a running one refuses (`INVALID_STATE`), and the window asks to pause it first.

### What the report says

`DownloadReport::sources` gives each source's URL, state (usable, unproven or disabled, with why), the bytes it served and its failures. Checkpoints name the source the download led with; a resume leads with that one again.
