# ADR-0019: A download can wait for the network

- **Status:** Accepted
- **Date:** 2026-11-05
- **Decided by:** the Product Owner
- **Issue:** #318

## Context

Since #317, a download rides out about 5 minutes without a network, keeping its bytes, and then fails. When the network comes back after a longer outage, the user has to click Retry on each one. #318 makes them start again by themselves.

`DownloadStatus` holds V1's fourteen values, and [CONTRACTS.md](../CONTRACTS.md) says a new one needs an ADR, so the UI stays consistent. A download that waits for the network is neither failed nor queued: it can't start until something outside the app changes, and it should not be counted or filtered as a failure.

The PO's decisions on #318 (2026-11-05, multiple-choice questions):

- **How the app learns the network is back:** it watches the system's network state on Windows and Linux, rather than trying again on a timer.
- **A setting:** "Restart downloads when the network is back", in Settings, Queue and performance, on by default.
- **How it shows:** a status of its own, "Waiting for network".
- **How long it waits:** without a limit, until the network comes back or the user cancels it.

## Decision

**`DownloadStatus` gains a fifteenth value, `waitingForNetwork`, shown as "Waiting for network".**

- **When:** the engine reports a download Failed with `TransferError::no_network` set (transfer contract version 20), and the setting is on. The engine sets it when no connection could be made: the name didn't resolve (libcurl's Resolve), the connection was refused (Connect) or there was no route (NoNetwork), or it timed out (Timeout), for HTTP, FTP and SFTP alike. A 404, a refused certificate, a full disk or any other failure stays Failed.
- **Set by the manager only,** never by an engine. The manager lets the engine forget the failed transfer and keeps the checkpoint, so the download resumes from its bytes.
- **In the queue:** it keeps its place but takes no slot, like a paused download. It is listed with the waiting downloads (the Queued view), not with the failed ones.
- **When the network changes:** the system's watcher (`velocity_core::network_watch`) raises a signal on any change of this computer's addresses; Windows' `NotifyUnicastIpAddressChange`, and a netlink route socket on Linux. At its next tick the manager puts every waiting download back to Queued, and they start as slots allow. If there's still no network, the engine's own retries (#317) end in the same failure, and the download waits again.
- **By hand:** Retry starts it now, where it is in the queue; Pause, Cancel and moving it work as for a queued download.
- **After a restart** of the app, it is Queued like any unfinished download, so it tries again at once.
- **With the setting off,** such a failure is Failed, as before, and turning the setting off fails the downloads that were waiting.
- **Not terminal:** `completed`, `failed` and `removed` stay the only terminal statuses.

## Options considered

| Option | For | Against |
|---|---|---|
| **A status of its own (chosen)** | Clear in the list, its filter and counts; can't be confused with a failure | A new contract value: an older build reads it as Unavailable |
| Failed, with a label "will restart when the network is back" | No new status | The Failed view and count would mix two kinds |
| Try again on a timer instead of watching | No OS code | Slower to react, and a failed try every few minutes while offline |

## Consequences

- **Contract:** `DownloadStatus` has 15 values in Rust, in `src/contract.ts` and in the contract fixtures. A build before 0.2.0 that reads a database with `waitingForNetwork` shows that download as Unavailable, never acting on it ([persistence rule](../../.claude/rules/persistence.md)).
- **Platforms:** watching works on Windows and Linux. macOS has no watcher yet; there the downloads wait until the app starts again or the user retries.
- **No new dependency:** `windows-sys` gains the IP Helper, NDIS and WinSock features it already ships in, and `velocity-core` uses the workspace's `libc` on Linux ([DEPENDENCIES.md](../DEPENDENCIES.md)).
