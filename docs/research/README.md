# Research

This folder keeps the research that Apollo Download Manager's decisions were based on, so a decision can always be traced to its evidence. Research documents are **inputs, not decisions**. When a decision overrides a research recommendation, the decision record says so. Decision records live in [docs/decisions/](../decisions/README.md).

| Date | Document | Status | Notes |
|---|---|---|---|
| 2026-10-21 | [Velocity libcurl download engine — research report, revision 2](2026-10-21-libcurl-engine-research-r2.md) | Research baseline for Apollo DM | Written about V1 at `e9d717a8`. Sections 4 (architecture) and 12 (recommendation) shaped [ADR-0001](../decisions/0001-v2-direction.md). Its aria2 assumptions (legacy engine, fallback, migration of aria2 downloads) do not apply to Apollo DM. |
| 2026-10-22 | [Engine prototype results](engine-prototype-results.md) | Evidence for #38 | Apollo DM's own findings from the #37 prototype: correctness in both modes on Windows and Linux. Performance not measured. |
| 2026-10-22 | [Engine mode costs](engine-mode-costs.md) | Evidence for #38 | What the child process costs against in-process: throughput, CPU, memory, latency, startup, shutdown and crash detection, on Windows and Linux (loopback). |
| 2026-11-05 | [Product name shortlist](2026-11-05-product-name-shortlist.md) | Input for #346 | Six candidate "<Name> Download Manager" names, checked for existing download managers, other software and trademark aggregator records. The official trademark databases were not searched; Singlbase does the legal clearance. |
| 2026-11-06 | [Torrent peer discovery, trackers and performance](2026-11-06-torrent-performance.md) | Input for #352 | What the torrent engine sets and leaves to libtorrent, a measured baseline on Windows, the public tracker options for the PO, and the follow-ups in order |
| 2026-11-13 | [Feature research: what to build next, and in which version](2026-11-13-feature-research.md) | Input for #427 and #461 | Other download managers' and torrent clients' features, what users wish for (Reddit, forums, feature requests), the site grabber, and a ranked roadmap by version. Appendices: [direct downloads](2026-11-13-feature-research-direct.md), [torrents](2026-11-13-feature-research-torrents.md), [user wishes](2026-11-13-feature-research-user-wishes.md), [site grabber](2026-11-13-feature-research-site-grabber.md) |

Copies of outside research here are verbatim exports. Corrections go into a new revision with its own date, never into an old copy.
