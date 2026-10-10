# Restore phase profiling (v4.3.18, 10 October 2026)

**Current follow-up:** v4.3.18 passed both main CI jobs. v4.3.19 compares repeated atomic-write batch sizes and retains the existing batch size because no material throughput gain was demonstrated. See [batch comparison and remaining acceptance](ATOMIC-BATCH-COMPARISON.md).

## CI acceptance

The [v4.3.17 main run](https://github.com/dailoclaw/ev/actions/runs/38027280462) passed both verification and browser jobs. The preceding v4.3.16 run also passed. This confirms remote acceptance of the v4.3.17 implementation; it does not certify physical devices or the live backend.

## Measurements and change

The standalone benchmark now separates time before the first restore transaction, the atomic snapshot/outbox transaction, and the subsequent full-queue read transaction. Profiling remains inside the test page and uses transaction completion events without changing production handlers. No database migration, durability setting or queue format change is introduced.

For the 25,000-row input with 320-character Notes under Chromium throttle 6, the pre-change sample measured 522 ms before the first transaction, 9,238 ms in the atomic transaction and 180 ms in the queue-read transaction; total save time was 9,972 ms. The dominant delay is inside the atomic write transaction. Its measured interval includes bounded JavaScript submissions and browser request processing/storage; it does not isolate disk I/O. Queue indexing would address only a small share of this sample and was not introduced.

Restore planning previously serialized a content signature for every incoming charge, even on an empty ledger with no existing content to match. It now computes a signature only when comparing a same-ID row or when unmatched existing content remains. Exhausted signature counts are removed. Existing same-ID conflict detection, multiset duplicate matching, UUID preservation, input normalization and preview/save recomputation remain in place.

| Worker case under throttle 6 | Preparation before | Preparation after | Total save before | Total save after |
|---|---:|---:|---:|---:|
| 1,000 rows | 23 ms | 19 ms | 124 ms | 107 ms |
| 10,000 rows | 174 ms | 164 ms | 813 ms | 794 ms |
| 25,000 rows | 485 ms | 436 ms | 4,247 ms | 4,061 ms |
| 25,000 rows, 320-character Notes | 522 ms | 448 ms | 9,972 ms | 10,445 ms |

These are single diagnostic samples, not statistical speed guarantees. Preparation work decreases in the samples, but dense total throughput does not improve. Maximum-size dense restores still take around ten seconds; physical memory and latency acceptance remain open. The change removes demonstrably unnecessary allocations without weakening validation or replacing atomic saves.

## Verification and remaining work

All 278 unit tests and the existing calculation coverage gate pass. Throttled Chromium worker/offline and unthrottled WebKit worker/offline scale checks retain durable row counts, pending writes and reinitialized rows, and reject the over-limit input. Eight affected Chromium/WebKit browser regressions pass, including repeated restore, failed restore retry, malformed backup rejection and late-write rollback. Lint, TypeScript/production build, bundle budgets and whitespace checks pass.

Continue investigating the dominant atomic write interval on a target browser/device before proposing a queue/schema redesign. Preserve one atomic snapshot/outbox commit, complete rollback, retry, account guards and newer-write revisions. Do not reduce durability or split a restore into independent commits merely to lower the measured time. Installed/deployed PWA, screen-reader, Excel and physical zoom checks remain manual; disposable Supabase acceptance remains removed from the active plan and not performed.
