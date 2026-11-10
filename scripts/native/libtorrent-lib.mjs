// Pure helpers for the libtorrent build (#62, docs/BUILDING_NATIVE.md): reading what vcpkg's
// libtorrent package says about itself, and checking the record crates/velocity-lt/build.rs reads.
// No I/O here, so every rule has a unit test (libtorrent-lib.test.mjs).
import { isAbsolute, join, relative, sep } from 'node:path';

/** The libtorrent version V2 builds and tests against (PO decision on #62); build.rs states it too. */
export const LIBTORRENT_VERSION = '2.0.15';

/** The vcpkg triplet per Rust target: static libraries, release only (cargo links release builds). */
export const TRIPLETS = {
  'x86_64-pc-windows-msvc': 'x64-windows-static-md-release',
  'x86_64-unknown-linux-gnu': 'x64-linux-release',
};

export const LIBTORRENT_INFO_SCHEMA = 1;

/**
 * Files a vcpkg port at the pinned baseline downloads from github.com, kept in
 * scripts/native/vcpkg-downloads/ because github.com rate-limits them (#454). The build places each
 * in vcpkg's downloads folder, where vcpkg uses a file whose SHA-512 matches the port's pin instead
 * of downloading it. `sha512` is the port's own pin; `url` is where the port fetches it.
 */
export const PRELOADED_DOWNLOADS = [
  {
    // boost-math (Boost Software License 1.0): boostorg/math's pull request merged as 05d9f24,
    // rebuilt with `git format-patch -n --full-index --no-signature 05d9f24^1..05d9f24^2` and
    // `*.hpp diff=cpp` (docs/BUILDING_NATIVE.md, "libtorrent").
    name: 'boost_math_android.patch',
    sha512: '19b6cf82f2e10b0154227e8e31eb892f3ca8899dd3946b909088be13b322a8881ff91b8aec2e2d099140f170f1d76547034e4def56ece347b6b52dbabeb1cf51',
    url: 'https://github.com/boostorg/math/commit/05d9f24f080f2c02ca34967c802f46851736e830.patch?full_index=1',
  },
];

/**
 * `vcpkg install`'s arguments. It cleans build trees and packages after each package to save disk,
 * but keeps downloads: `--clean-after-build` would also empty vcpkg's downloads folder, and with it
 * the files placed there (#454).
 */
export function vcpkgInstallArgs(triplet, manifestRoot, installRoot) {
  return ['install', '--triplet', triplet, `--x-manifest-root=${manifestRoot}`, `--x-install-root=${installRoot}`, '--clean-buildtrees-after-build', '--clean-packages-after-build'];
}

/**
 * What to do with a file of PRELOADED_DOWNLOADS, from the SHA-512 of the repository's copy and of
 * the one in vcpkg's downloads folder (`null` when there is none): 'place' it, or leave it
 * 'present'. A repository copy that isn't the pinned file is refused, never placed.
 */
export function preloadAction(file, sourceSha512, downloadedSha512) {
  if (sourceSha512 !== file.sha512) {
    throw new Error(`scripts/native/vcpkg-downloads/${file.name} has SHA-512 ${sourceSha512}, not the ${file.sha512} its vcpkg port pins`);
  }
  return downloadedSha512 === file.sha512 ? 'present' : 'place';
}

/**
 * Definitions that change libtorrent's types or which code it has: the shim must be compiled with
 * them, so a record without them describes a build the shim would disagree with.
 */
const REQUIRED_DEFINES = ['TORRENT_NO_DEPRECATE', 'TORRENT_USE_OPENSSL', 'TORRENT_USE_LIBCRYPTO', 'TORRENT_SSL_PEERS'];

const SHA1_HEX = /^[0-9a-f]{40}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;

/** The quoted value of one property in LibtorrentRasterbarTargets.cmake. */
function property(text, name) {
  const m = new RegExp(`${name} "([^"]*)"`).exec(text);
  if (!m) throw new Error(`the libtorrent CMake package has no ${name}`);
  // The file escapes generator expressions as \$<...>.
  return m[1].replaceAll('\\$', '$');
}

/**
 * The release meaning of one entry: the entry itself, the inside of a release-only or link-only
 * expression, or null for a debug-only one. Any other generator expression is refused rather than
 * guessed at.
 */
function releaseEntry(entry) {
  if (!entry.includes('$<')) return entry;
  let m = /^\$<\$<CONFIG:debug>:([^$<>]+)>$/i.exec(entry);
  if (m) return null;
  m = /^\$<\$<NOT:\$<CONFIG:debug>>:([^$<>]+)>$/i.exec(entry);
  if (m) return m[1];
  m = /^\$<LINK_ONLY:([^$<>]+)>$/.exec(entry);
  if (m) return m[1];
  throw new Error(`the libtorrent CMake package has a generator expression this build doesn't understand: ${entry}`);
}

function releaseList(value) {
  return value
    .split(';')
    .filter(Boolean)
    .map(releaseEntry)
    .filter((e) => e !== null);
}

/** The release compile definitions and link entries of vcpkg's libtorrent target, in its order. */
export function parseTargets(text) {
  return {
    defines: releaseList(property(text, 'INTERFACE_COMPILE_DEFINITIONS')),
    links: releaseList(property(text, 'INTERFACE_LINK_LIBRARIES')),
  };
}

/** The version from LibtorrentRasterbarConfigVersion.cmake. */
export function parsePackageVersion(text) {
  const m = /set\(PACKAGE_VERSION "([^"]+)"\)/.exec(text);
  if (!m) throw new Error('the libtorrent CMake version file has no PACKAGE_VERSION');
  return m[1];
}

/**
 * What each imported target means per Rust target: static libraries from the vcpkg prefix and the
 * system libraries they need. A static OpenSSL needs the Windows libraries its own build links,
 * and pthread and dl on Linux. Boost is header-only for libtorrent's use, so it links nothing.
 */
const IMPORTED = {
  'x86_64-pc-windows-msvc': {
    'Threads::Threads': { staticLibs: [], systemLibs: [] },
    'OpenSSL::SSL': { staticLibs: ['libssl', 'libcrypto'], systemLibs: ['advapi32', 'crypt32', 'user32', 'ws2_32'] },
    'Boost::headers': { staticLibs: [], systemLibs: [] },
  },
  'x86_64-unknown-linux-gnu': {
    'Threads::Threads': { staticLibs: [], systemLibs: ['pthread'] },
    'OpenSSL::SSL': { staticLibs: ['ssl', 'crypto'], systemLibs: ['pthread', 'dl'] },
    'Boost::headers': { staticLibs: [], systemLibs: [] },
  },
};

/** The libraries to link for libtorrent's link entries, libtorrent first, without duplicates. */
export function librariesForLibtorrent(target, links) {
  const imported = IMPORTED[target];
  if (!imported) throw new Error(`no libtorrent build is established for ${target}`);
  const staticLibs = ['torrent-rasterbar'];
  const systemLibs = [];
  const add = (list, names) => names.forEach((n) => list.includes(n) || list.push(n));
  for (const entry of links) {
    if (entry.includes('::')) {
      const known = imported[entry];
      if (!known) throw new Error(`libtorrent links ${entry}, which this build has no mapping for`);
      add(staticLibs, known.staticLibs);
      add(systemLibs, known.systemLibs);
    } else {
      add(systemLibs, [entry]);
    }
  }
  return { staticLibs, systemLibs };
}

/**
 * The prefix as the record keeps it: relative to `nativeDir` (target/native), with forward slashes, so a moved or
 * renamed checkout still finds it. The repository's rename broke records that held the absolute path.
 */
export function recordedPrefix(nativeDir, prefix) {
  return relative(nativeDir, prefix).split(sep).join('/');
}

/** The prefix a record names, as a path: from `nativeDir` when it is relative; an older record's absolute one as it is. */
export function prefixFor(nativeDir, prefix) {
  return isAbsolute(prefix) ? prefix : join(nativeDir, ...prefix.split('/'));
}

/** Problems with a libtorrent-info.json record; empty when it is complete and matches V2's pins. */
export function checkLibtorrentInfo(info) {
  const problems = [];
  if (info.schema !== LIBTORRENT_INFO_SCHEMA) problems.push(`schema is ${info.schema}, expected ${LIBTORRENT_INFO_SCHEMA}`);
  const triplet = TRIPLETS[info.target];
  if (!triplet) problems.push(`target ${info.target} has no established libtorrent build`);
  else if (info.triplet !== triplet) problems.push(`triplet is ${info.triplet}, expected ${triplet}`);
  if (info.libtorrent !== LIBTORRENT_VERSION) problems.push(`libtorrent is ${info.libtorrent}, expected ${LIBTORRENT_VERSION}`);
  if (!SHA1_HEX.test(info.vcpkgBaseline ?? '')) problems.push(`vcpkgBaseline is not a full commit id: ${info.vcpkgBaseline}`);
  if (typeof info.prefix !== 'string' || !info.prefix) problems.push('prefix is missing');
  if (!Array.isArray(info.defines) || info.defines.length === 0) problems.push('defines is empty');
  else {
    const missing = REQUIRED_DEFINES.filter((d) => !info.defines.includes(d));
    if (missing.length) problems.push(`defines lacks ${missing.join(', ')}`);
  }
  if (!Array.isArray(info.staticLibs) || info.staticLibs[0] !== 'torrent-rasterbar') problems.push('staticLibs must start with torrent-rasterbar');
  if (!Array.isArray(info.systemLibs)) problems.push('systemLibs is missing');
  if (!SHA256_HEX.test(info.cacheKey ?? '')) problems.push('cacheKey is not a SHA-256');
  return problems;
}
