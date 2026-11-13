# ADR-0021: A torrent's tracker addresses are saved in the system keychain when the user asks

- **Status:** Accepted
- **Date:** 2026-11-13
- **Decided by:** the Product Owner
- **Issue:** #472

## Context

A private tracker's address carries the user's passkey, such as `https://tracker.example/announce?passkey=…`. Apollo Download Manager keeps no secret in its database, logs or checkpoints (AGENTS.md, "Secrets stay out of storage"). So a torrent's tracker addresses live in memory only, and libtorrent's resume data is saved without them ([TORRENTS.md](../TORRENTS.md)). After a restart a private torrent has no tracker, and private torrents use no DHT or peer exchange, so it finds no peers. Today the user adds it again.

[ADR-0015](0015-keychain-with-consent.md) put logins in the system keychain, with the user's consent, one download at a time, and left tracker passkeys out ("Follow-up"). The research for v0.3.0 ranked private trackers kept after a restart as a v0.3.0 item (#427). The PO decided, on 2026-11-13: "Yes, in the keychain", and, choosing how the user agrees: "Checkbox, every torrent".

## Decision

**A torrent's tracker addresses are saved in the system keychain when the user asks, for that torrent, the way ADR-0015 saves a login.**

- **Consent:** "Remember this torrent's trackers in the system keychain", in the Add dialog and in the details panel's **Edit…**, unticked by default. It's offered for every torrent, private or public (PO decision on #472).
- **What is saved:** every tracker the torrent has: those the user typed, a magnet link's, and those in its metadata or resume data, where a private `.torrent` file keeps its passkey tracker.
- **Where:** under ADR-0015's service name (`<identifier>.logins`), in entries of the download's own: `<id>.trackers` holds how many parts there are, and `<id>.trackers.0`, `.1`, … hold the list in parts of at most 1,000 characters. Windows Credential Manager keeps at most 1,280 characters in one entry (measured on Windows 11: 1,270 kept, 1,320 refused), and a private torrent's trackers can be longer. Removing the download deletes every part.
- **After a restart:** the torrent gets its trackers back from the keychain and is added again with them. Without them (not remembered, deleted, or no keychain), it comes back as before, and its details say why its trackers are missing.
- **Nothing else changes:** no tracker address reaches the database, logs, checkpoints, resume data or a process's arguments. Shown addresses stay redacted, and the secret-leak scan (#71) covers them.

## Options considered

| Option | For | Against |
|---|---|---|
| **A checkbox for every torrent, off by default (chosen)** | Same consent as logins (ADR-0015); nothing saved without asking; public torrents can use it too | One more box to tick |
| Ask once when a private torrent is added | Only asks where it matters | A prompt the user didn't start; public torrents can't use it |
| One setting for all torrents | Simplest | Saves secrets the user may not expect to be saved |
| Memory only, as before | Nothing stored | A private torrent finds no peers after every restart |

## Consequences

- **`remember_trackers`** joins the contract, and the stored torrent options record that trackers were saved (`trackersSaved`), never the trackers themselves.
- **Torrents added before this** can't get their trackers back. Those trackers were never kept, so the user adds such a torrent again once (#472's scope).
- **A keychain entry has a size limit:** 2,560 bytes on Windows, which is 1,280 characters as UTF-16. Tracker lists are split into parts that fit, so all 64 trackers a torrent may have (`MAX_TRACKERS`) can be remembered. A login (ADR-0015) stays well inside one entry.
- **ADR-0015 stays as it is.** This record extends its approach to tracker addresses.
