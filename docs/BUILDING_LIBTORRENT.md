# Building libtorrent

How libtorrent, which only the torrent bridge calls, is built for the torrent helper. libcurl and its libraries are in [BUILDING_NATIVE.md](BUILDING_NATIVE.md). Split from BUILDING_NATIVE.md by #425.

## libtorrent

The torrent bridge ([`crates/velocity-lt`](../crates/velocity-lt/)) links libtorrent-rasterbar 2.0.15, Boost 1.91 and OpenSSL 3.5.9, built with [vcpkg](https://github.com/microsoft/vcpkg) (PO decisions on #62). `pnpm native:build` builds them after libcurl, with [`scripts/native/libtorrent.mjs`](../scripts/native/libtorrent.mjs).

- **The pins:**
  - **The registry:** [`scripts/native/vcpkg/vcpkg.json`](../scripts/native/vcpkg/vcpkg.json) pins the vcpkg registry by its `builtin-baseline` commit, `9e593bb` (2026-07-29). Boost and vcpkg's own helpers come from that commit.
  - **Overlay ports:** the registry offers libtorrent 2.0.11 and then 2.1.x, and OpenSSL 3.5 only up to 3.5.4. So libtorrent 2.0.15 and OpenSSL 3.5.9 come from overlay ports in [`scripts/native/vcpkg/ports`](../scripts/native/vcpkg/ports). Each is vcpkg's own recipe (libtorrent 2.0.11's, OpenSSL 3.5.4's) with only the version and the SHA-512 changed, and libtorrent's licence field corrected to its `LICENSE` file. The repository stores two of the OpenSSL port's files with LF where vcpkg has CRLF; its patches are byte for byte vcpkg's.
  - **Checksums:** vcpkg checks each source's SHA-512 on every download. Those archives are GitHub's archives of the release tags. Apollo Download Manager hasn't checked them against release signatures, as it does for libcurl's sources.
  - **Files kept in the repository (#454):** github.com rate-limits some downloads, answering HTTP 429 even with a token, and release candidates build without a cache. So [`scripts/native/vcpkg-downloads/`](../scripts/native/vcpkg-downloads) keeps those files, and `libtorrent.mjs` places them in vcpkg's downloads folder before `vcpkg install`. vcpkg then reports "Using cached" and never fetches them. `vcpkg install` cleans build trees and packages after each package, but not downloads (`--clean-after-build` would remove the placed files before the package that needs them is built). Each must have the SHA-512 its port pins: the build checks it, and so does vcpkg. The list is `PRELOADED_DOWNLOADS` in [`libtorrent-lib.mjs`](../scripts/native/libtorrent-lib.mjs). Today it holds one file, boost-math's `boost_math_android.patch` (Boost Software License 1.0). Its port fetches it from `github.com/boostorg/math/commit/05d9f24….patch?full_index=1`. GitHub's API serves a different form, so it was rebuilt with git: `git format-patch -n --full-index --no-signature 05d9f24^1..05d9f24^2`, with `*.hpp diff=cpp` set, which gives exactly the pinned SHA-512. When a new vcpkg baseline changes the port, the test that checks the file against its pin fails, and the file is replaced or removed.
- **Release only:** the triplets are `x64-windows-static-md-release` and `x64-linux-release`, so only release libraries are built; cargo links those in every profile. libtorrent is built without iconv (`"default-features": false`).
- **The record:** the build writes `target/native/<target>/libtorrent-info.json`:
  - libtorrent's version and the vcpkg baseline;
  - the install prefix, relative to [`target/native`](../target/native/) (`vcpkg-installed/<triplet>`), so a moved or renamed checkout still finds it. Records written before the repository's rename hold an absolute path; `native:build` rebuilds them, and `build.rs` still reads one;
  - the compile definitions and link libraries, read from libtorrent's CMake package. The shim must be compiled with the same definitions as libtorrent, such as `TORRENT_USE_OPENSSL` and `TORRENT_SSL_PEERS`;
  - the SHA-256 of each library.

  [`crates/velocity-lt/build.rs`](../crates/velocity-lt/build.rs) refuses to build without it, or when it records another libtorrent version. A generator expression the build doesn't know is refused rather than guessed at.
- **Reuse:** the build is reused while the manifest, the ports, `libtorrent.mjs` and `libtorrent-lib.mjs` are unchanged and every library still has its recorded SHA-256. vcpkg also keeps built packages in its own binary cache.
- **vcpkg itself:** `libtorrent.mjs` uses `VCPKG_ROOT` when it is set, else `C:\vcpkg` on Windows and `~/vcpkg` on Linux. The clone must contain the baseline commit. `pnpm check:prereqs` reports a missing vcpkg.
  - **Windows:** `git clone https://github.com/microsoft/vcpkg C:\vcpkg`, then `C:\vcpkg\bootstrap-vcpkg.bat -disableMetrics`.
  - **Linux:** `sudo apt install curl zip unzip tar`, then `git clone https://github.com/microsoft/vcpkg ~/vcpkg` and `~/vcpkg/bootstrap-vcpkg.sh -disableMetrics`. vcpkg downloads its own CMake and Ninja.
- **In CI** (#205): the native libraries are cached on their own, and vcpkg is set up at the baseline commit only when they have to be built ([CI_COSTS.md](CI_COSTS.md#caching)).
- **Memory:** compiling libtorrent takes up to about 1.3 GB per compiler process. On a 2 GB WSL the compiler was killed for lack of memory. Raise WSL's memory in `.wslconfig`, or set `VCPKG_MAX_CONCURRENCY` lower (this machine uses 4 with 6 GB).
- **Measured times** (cold, 2026-10-26; Boost and OpenSSL make up most of it):

  | Platform | Machine | Time |
  |---|---|---|
  | Windows 11 | 16 logical CPUs, VS Build Tools 2022; debug and release | 860 s |
  | Linux, Ubuntu 24.04 in WSL2 | 8 vCPUs, 6 GB, `VCPKG_MAX_CONCURRENCY=4`; release only | 1939 s |

  A clean Windows time for the release-only triplet wasn't measured: that run shared the CPU with other builds.
- **Not yet Apollo Download Manager's own build:** releases are meant to link libraries Apollo Download Manager builds from verified sources, as for libcurl. Building libtorrent and Boost that way is a release blocker ([APPROVED_DEPENDENCIES.md](APPROVED_DEPENDENCIES.md#release-blockers-related-to-provenance)).
