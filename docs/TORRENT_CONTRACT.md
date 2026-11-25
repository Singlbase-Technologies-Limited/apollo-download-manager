# The torrent contract

The `TorrentEngine` contract between the manager and the torrent helper: its commands, events and snapshots, and the torrent settings and identity it carries. How torrents work around it is in [TORRENTS.md](TORRENTS.md). Split from TORRENTS.md by #425.

## The torrent contract

`TORRENT_CONTRACT_VERSION` is 8: version 1 had no file choice, version 2 no seeding or resume data, version 3 no trackers, peers, limits or port settings, version 4 no proxy, version 5 no `moveStorage` (#366), version 6 no piece order, and version 7 no network adapter. Version 7 added `inOrder` and `endsFirst` to the spec and `setOrder` (#470), and version 8 `networkAdapter` to the settings and `adapterMissing` to `network` (#471). In order is libtorrent's `sequential_download` flag. Ends first puts each wanted file's first and last piece at the top priority once the torrent's files are wanted, again whenever it is added again; switching it off puts those pieces back to their file's priority. Every wire form refuses unknown fields.

| Command | Reply | What it does |
|---|---|---|
| `version {}` | `version { libtorrent }` | The libtorrent version, for diagnostics; also the supervisor's hang check |
| `setSettings { settings }` | `done {}` | [The settings](#settings-and-identity) |
| `setProxy { proxy }` | `done {}` | The user's proxy, or none (#192): [below](#settings-and-identity) |
| `add { spec }` | `added { id }` | `spec`: `source` (`{"kind":"file","path":…}`, `{"kind":"magnet","uri":…}` or `{"kind":"resume"}`), `directory`, `trackers`, `paused`, `chooseFiles`, `files` (a `.torrent` file's first choice, or `null` for every file), `seeding` (its [policy](TORRENT_LIFECYCLE.md#seeding)), and `uploadLimit` and `downloadLimit` (bytes per second, 0 for none) |
| `restore { id, spec }` | `done {}` | Adds a torrent under an id an earlier helper gave it ([Recovery](TORRENT_LIFECYCLE.md#resume-data-and-recovery)). `INVALID_INPUT` for an id the helper has, or could still give |
| `setFiles { id, files }` | `done {}` | Downloads exactly these files ([File choice](TORRENTS.md#file-choice)) |
| `setSeeding { id, seeding }` | `done {}` | Sets when the torrent stops seeding; `{"mode":"never"}` stops it ([Seeding](TORRENT_LIFECYCLE.md#seeding)) |
| `metadata { id, offset }` | `metadata { chunk }` | `chunk`: `total`, `offset`, `hex`: at most 1 MiB of the metadata from `offset`; `INVALID_STATE` before it is known |
| `upload { chunk }` | `done {}` | Part of the resume data the next `{"kind":"resume"}` source adds from, in order from offset 0 ([Resume data](TORRENT_LIFECYCLE.md#resume-data-and-recovery)) |
| `saveResume {}` | `saved { ids }` | Asks for every torrent's resume data now; it follows as `resumeData` events |
| `pause { id }`, `resume { id }` | `done {}` | `INVALID_STATE` for a completed torrent that doesn't seed |
| `remove { id }` | `done {}` | Forgets the torrent. Its files are always kept |
| `setLimits { id, upload, download }` | `done {}` | The torrent's own limits, in bytes per second, 0 for none |
| `trackers { id }` | `trackers { trackers }` | Each tracker: its URL redacted, tier, state (`working`, `updating`, `error` or `notContacted`), message, failures, seconds to the next announce, and the seeds and peers it counted ([Trackers and peers](TORRENT_LIFECYCLE.md#trackers-and-peers)) |
| `reannounce { id }` | `done {}` | Announces to the torrent's trackers now |
| `peers { id }` | `peers { peers }` | Each connected peer: address, port, speeds, whether it is a seed, its progress in thousandths, and its client |
| `network {}` | `network { network }` | The listening port, a listen error, and the port-mapping state ([Settings](#settings-and-identity)) |
| `snapshot {}` | `snapshot { torrents }` | The state of every torrent |

- **Events:** `changed { snapshot }`, `removed { id }`, and `resumeData { id, chunk }`, the torrent's resume data in chunks sent in order.
- **A snapshot** also carries `uploadedBytes` and `seedingSecs`, over the torrent's life, and `seedQueued`.
- **A `.torrent` file by path:** the helper reads the file itself. A large one would not fit the protocol's 4 MiB message limit.
- **Errors:**
  - **The input:** `NOT_FOUND` for an unknown id or a missing file, `INVALID_INPUT` for metadata that doesn't pass the checks, `INVALID_FILENAME` for an unsafe name, `INVALID_URL` for a bad link or tracker, `DESTINATION_MISSING` or `INVALID_PATH` for the folder.
  - **Duplicates:** `FILE_EXISTS` for a torrent the helper already has.

### Statuses

The helper reads libtorrent's state every 250 ms (a starting value) and sends `changed` when a torrent's snapshot changes.

| libtorrent | Apollo DM status |
|---|---|
| An error | Failed, with libtorrent's message (not retryable) |
| Paused | Paused |
| Checking files or resume data | Verifying |
| A magnet whose metadata isn't known and checked yet | Fetching metadata |
| Files known, none chosen yet | Choosing files |
| Metadata that failed Apollo DM's check | Failed, with the reason (not retryable) |
| Downloading | Downloading |
| Finished, being flushed | Verifying |
| Flushed and stopped | Completed |
| Flushed, and seeding under its policy | Seeding |
| Flushed, and waiting for a seeding slot | Completed, with `seedQueued` |
| Flushed, and paused by the user while it may seed | Paused |

- **Completion:** a torrent is Completed only after every wanted piece has passed its hash check and libtorrent has flushed its files to disk. It then stops, and seeds only under a policy ([Seeding](TORRENT_LIFECYCLE.md#seeding)).
- **Speeds:** a stopped completed torrent shows no speed. libtorrent's averaged rates take a while to fall, so the helper reports 0 instead.
- **Progress:** it counts the bytes of the wanted files. Padding is never counted, and the size is unknown until the files are chosen.
- **A crashed helper:** the torrents it had fail with a retryable error, then come back ([Recovery](TORRENT_LIFECYCLE.md#resume-data-and-recovery)).

## Settings and identity

The Settings screen's BitTorrent section edits them ([SETTINGS.md](SETTINGS.md#advanced-and-new-torrents), #30). A new helper starts with every kind of peer discovery off and listens nowhere in particular, and the supervisor sends the settings right after the handshake. The defaults are V1's (PO decisions on #62), apart from the port:

| Setting | Default | Limits | What it does |
|---|---|---|---|
| `dht`, `peerExchange`, `localPeerDiscovery` | on, on, off | | How peers are found besides trackers. Private torrents never use DHT or peer exchange, which libtorrent enforces |
| `maxActiveSeeds` | 0 | 0 to 1,000 | [Seeding](TORRENT_LIFECYCLE.md#seeding) |
| `listenPort` | 6890 | 0, or 1,024 to 65,535 | The TCP and UDP port on every interface. V1's 6881 and 6882 are never reused (PO decision on #62). 0 picks one free port when it is set, the same on every interface; libtorrent given 0 itself would pick one per interface. The port picked is free for both TCP and UDP (#438): Windows reserves port ranges per protocol, so a free TCP port can be a reserved UDP one, and libtorrent couldn't listen on it at all |
| `portMapping` | off | | Asks the router to forward the port, by UPnP and NAT-PMP |
| `uploadLimit`, `downloadLimit` | 0 | 0 to 2,147,483,647 bytes per second | All torrents together; 0 for none. Separate from the direct downloads' limit (PO decision on #62) |
| `extraTrackers` | none | at most 64, each a valid tracker | Added to every public torrent added from then on. A private torrent never gets them, since they would learn its info hash and the user's address (#377). A magnet link doesn't say whether it's private, so it has them until its metadata arrives; libtorrent doesn't share a private torrent's metadata with peers anyway |
| `maxPeersPerTorrent` | 55 | 1 to 512 | Peers each torrent added from then on connects to at most |
| `dhtBootstrapNodes` | none | at most 16, each `host:port` | Where DHT starts from (V1's `dht_entry_point`); none means libtorrent's own default nodes |
| `networkAdapter` | none (any) | an adapter's id: letters, digits and `{}-_.`, at most 256 bytes | The one adapter torrents use (#471), such as a VPN's. libtorrent listens on it alone (`listen_interfaces` `<id>:<port>`) and reaches peers and trackers through it alone (`outgoing_interfaces`). On Windows the id is the adapter's GUID: tried with libtorrent 2.0, a friendly name such as "Wi-Fi" listened nowhere and reported nothing. On Linux it is the interface's name. While the adapter is gone or not connected, torrents connect through no other, and `network` reports it as `adapterMissing`, since libtorrent says nothing itself. The list to choose from is `velocity_core::adapters` (Windows `GetAdaptersAddresses`, Linux `getifaddrs`), without loopback |

- **Local peers:** libtorrent doesn't apply the global limits to peers on the local network, as with V1. A torrent's own limits apply to every peer.
- **A port that is taken:** libtorrent moves on to the next free port, as with V1, and `network` says so: the port really used, and "port 6890 couldn't be opened; listening on 6891" (PO decision on #62). Port mapping maps the port really used.
  - **Windows:** another program's socket that didn't ask for exclusive use can share the port with libtorrent's. The helper then listens on it, with nothing to report.
- **Listen errors:** an interface libtorrent can't listen on is reported by `network` too. It stays reported until the port changes, even if another interface works, since peers on the failed one can't connect.
- **Port mapping:**
  - **The states** are V1's: `off`, `searching`, `mapped` (the external port, and `upnp` or `natpmp`), `failed` (both protocols, with their reasons), and `noRouter` when nothing answered within 30 s.
  - **A later failure** never hides a working mapping.
  - **What resets it:** turning it on, or changing the port, starts a new search.
- **V1's aria2 network settings:**
  - **`listen_port` and `dht_listen_port`:** these were aria2's two ports. libtorrent uses `listenPort` for TCP, uTP and DHT alike.
  - **`enable_dht6`:** aria2's too. libtorrent runs DHT on every listening socket, IPv4 and IPv6 together, under `dht`, as V1's libtorrent engine did.
- **Not kept from V1:** `request_peer_speed_limit_kib` (aria2's "look for more peers while slower than this") is dropped, as ADR-0005 planned for a setting libtorrent can't do. libtorrent 2.0.15 has no such setting; it finds peers on its own within its connection limits.
- **Through the user's proxy** (#192, PO decision): peers, trackers and the names they use go through it (libtorrent's `proxy_peer_connections`, `proxy_tracker_connections`, `proxy_hostnames`), with its login. Nothing Apollo Download Manager starts goes around it: local peer discovery and port mapping are off while it is set, and the DHT is on only through a SOCKS5 proxy, which carries it. The supervisor gives every helper the proxy before its settings, and the app gives the first helper the saved one, with a remembered password, so no connection is made before it. libtorrent can't use an HTTPS proxy: then every kind of discovery is off, and the app starts no torrent (`PROXY_UNSUPPORTED`). The helper still listens on its port, so a peer can connect to it; listening on loopback only would also keep libtorrent from reaching a remote proxy. Tested through a local SOCKS5 proxy with a login (`tests/network.rs`).
- **Identity:** peers see the peer-id prefix `-VD0100-` (`-VD` and the version digits), and trackers see `Apollo Download Manager/0.2.0 libtorrent/2.0.15.0` (PO decision on #62; named `Velocity/…` until 0.2.0, #347). V1's `-VL` prefix isn't reused.
