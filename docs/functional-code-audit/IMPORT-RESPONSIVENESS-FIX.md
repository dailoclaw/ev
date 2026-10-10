# Import responsiveness fix (v4.3.17, 10 October 2026)

**Remote acceptance and next profile:** v4.3.17 passed both main CI jobs. v4.3.18 profiles restore transaction phases and removes unnecessary content-signature work, while recording the remaining atomic-write bottleneck. See [phase profiling results](IMPORT-PHASE-PROFILE.md).

## Change and safety

Profiling the throttled worker benchmark measured approximately 0.6 seconds spent synchronously submitting 25,000 outbox `put` requests. The cache writer now submits at most 250 operations per request-event callback. Every group and the snapshot still belong to one read/write transaction. Completion resolves only when that transaction commits; submission errors abort it and preserve the original error.

Continuation runs inside the last request's success event, when the transaction is active according to the [IndexedDB transaction lifecycle specification](https://www.w3.org/TR/IndexedDB/#transaction-lifecycle). It does not use a timer between groups or split restores into independently committed transactions. Ordinary small writes keep their existing single-submission behavior. Account guards, revision tokens, ordering and publish-after-commit behavior remain in place.

The standalone benchmark also measures snapshot and outbox submission time separately. Instrumentation is confined to the test page; no production profiling or logging is added.

## Diagnostic comparison

Both samples used the same instrumented worker benchmark with Chromium main-thread throttle 6. These single samples demonstrate reduced timer stalls, not a statistically established total-throughput improvement.

| Charges / Notes | Before max timer delay | After max timer delay | Before save | After save |
|---|---:|---:|---:|---:|
| 1,000 / none | 74 ms | 66 ms | 110 ms | 138 ms |
| 10,000 / none | 617 ms | 369 ms | 677 ms | 740 ms |
| 25,000 / none | 1,585 ms | 904 ms | 4,085 ms | 4,026 ms |
| 25,000 / 320 chars | 1,682 ms | 993 ms | 9,539 ms | 10,653 ms |

Dense maximum-size total saves still take around ten seconds. Main-thread normalization, planning, serialization and queue diagnostics remain separate work; this patch does not claim to eliminate those stalls. Physical-device memory/responsiveness acceptance remains open. Supported size limits are unchanged.

## Verification

- 278 unit tests and the existing coverage gate pass, including a new 601-operation regression that injects quota failure at operation 501, requires complete snapshot/queue rollback, and verifies successful retry.
- Real Chromium and WebKit repeat the late-submission failure test, comparing the complete original queue including revision tokens before retry. This regression is in the normal browser suite and therefore runs on CI's Edge project too; no local Edge result is claimed.
- Both throttled Chromium scale paths and both unthrottled WebKit paths pass durable snapshot, outbox count, reinitialization and over-limit rejection assertions.
- Affected browser regressions cover failed durable edits, backup validation, offline/repeated restores, retry and recovery archives. Static/build checks are recorded after final changes.

Eighteen affected browser checks pass across Chromium/WebKit. Lint, TypeScript/production build and bundle budgets pass.

The final Chromium/WebKit production suite passes seven checks; the pre-existing WebKit controlled offline-navigation case remains explicitly skipped. Offline queued writes, worker replacement and missing-chunk recovery are covered by the passing checks.

The specifically intermittent WebKit route/CSP check additionally passes three independent repetitions with retries disabled. Remote Ubuntu/Edge verification remains pending after push.

## CI diagnostic follow-up

The [v4.3.15 main run](https://github.com/dailoclaw/ev/actions/runs/38021732884) failed despite the previous release passing. New annotations identify WebKit access-control errors for startup providers, sessions and settings requests in the production route/CSP test; ten production checks passed, one failed and one was skipped. Development browser regression passed all 135 checks.

The route test previously advanced as soon as the shell/lazy component rendered, which can precede startup remote sync. It now waits for completed initial and canonical GET requests for each table in this one-page fixture before advancing to the next full navigation; Settings additionally requires its sync badge to be synced before checking the final backup result. This strengthens readiness and retains all CSP/runtime-error assertions. It is a targeted test correction for a possible navigation race, not proof that access-control errors have no other cause. A successful remote rerun is still required; v4.3.16 CI was in progress at this check.

Repeat with the commands in [performance acceptance](IMPORT-PERFORMANCE-ACCEPTANCE.md). The next profiling target is synchronous restore preparation and full-queue diagnostics, with atomicity and account-state checks preserved.
