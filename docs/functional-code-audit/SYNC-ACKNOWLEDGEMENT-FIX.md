# Sync acknowledgement fix — v4.3.2

Implemented locally on 9 October 2026 on `codex/audit-fixes`. No deployment performed.

## Completed scope

Addresses C1 in REPORT.md: an earlier upload could delete a newer edit or delete queued under the same entity key.

- Every durable queue write now receives a unique revision, including identical payloads and matching timestamps.
- Upload completion compares the uploaded revision and owner against the current stored entry, then deletes only a match within one IndexedDB read/write transaction.
- Legacy queued entries receive persistent revisions in place. Concurrent reads share the same upgraded revision and retain the original payload and owner.
- The existing sync loop retains pending replacements and uploads them on its next pass.
- Version and both changelogs updated to 4.3.2.

## Verification

All checks passed against the final code:

- `npm run lint`
- `npm run typecheck`
- `npm run test:coverage`: 48 tests across 10 files
- `npm run build`
- `npm run check:bundle`
- `npm run test:e2e`: 18 tests in Chromium and WebKit
- `npx vitest run --config docs/functional-code-audit/vitest.config.ts`: 8 tests
- `git diff --check`

Cache regressions cover all six replacement action types, identical writes, equal timestamps, repeated acknowledgements, and legacy entries. Integration regressions pause a session upload, durably queue an edit or delete, resume the upload, and assert the latest result in the fake backend, application state and persisted snapshot.

The isolated audit suite now contains one passing regression for this fix and seven tests that still demonstrate unresolved audit findings. Passing that suite does not mean those remaining findings are fixed. Existing coverage percentages describe only the configured calculation modules, not the whole app. Browser checks use the isolated test backend, not production Supabase.

## Remaining work

This completes the acknowledgement portion of audit plan Step 1, not its full acceptance gate. Session epochs/account-switch protection (C6), dependency scheduling (M5), and paused-network tests for the remaining workflows still need implementation. Atomic local acknowledgement does not serialize simultaneous uploads from different tabs or resolve conflicting server writes. Legacy tabs running the previous code can still perform the old unconditional deletion until updated.

Continue with session epochs and lifecycle guards, then dependency ordering. Next address truthful save failures and storage recovery in plan Step 2. The application retains the production-readiness limitations in REPORT.md until those gates pass.
