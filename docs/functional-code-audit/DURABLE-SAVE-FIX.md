# Durable saves and storage recovery — v4.3.5

Implemented on 9 October 2026 for C2, M11 and M13 in REPORT.md. The checks below ran locally before publication; no manual deployment was performed.

## Behavior

All ledger mutations return promises. A per-session local-write queue builds each change from the latest committed application state, atomically persists its snapshot and outbox operations, then publishes it. A failed commit rejects the save, preserves the prior ledger and queue, and displays an actionable save error. Failure does not poison the write queue; subsequent actions can retry. Sign-out still invalidates stale queued work and completion handlers.

Remote snapshot adoption and legacy migration use the same local-write queue. Remote adoption checks for pending operations inside that queue before saving or publishing, so a concurrently committed local edit cannot be overwritten by an older response. Cloud network requests remain independent of local writes; a paused upload does not block editing. Offline events and dismissed save errors are preserved when remote commits finish.

- Add and Edit await durability, disable submission while saving, preserve inputs on failure, and play success feedback only after commit.
- New-provider/charge creation is one transaction. Backup merges also validate and build the complete result before a single transaction, eliminating partial success caused by sequential fire-and-forget mutations.
- Delete leaves a row in place on failure. Undo stays available if restoration fails and prevents duplicate submission while pending.
- Settings, provider controls, theme/style/density and vehicle assumptions consume save outcomes. A visible dismissible save-error banner covers quick controls; appearance changes apply only after a successful settings save.
- Photo upload errors retain the compressed image for an explicit Retry photo save action. Removal leaves the existing photo intact on storage failure. Restore retains its preview until successful completion.
- Optional localStorage reads, preference mirrors, backup markers and legacy migration markers cannot prevent an IndexedDB save. Successfully migrated owners are tracked in memory if the optional marker cannot be written.
- IndexedDB open failures reset the cached promise for retry. Blocked opens report an actionable message; late completion of a rejected open closes its connection. Version-change/close events invalidate the connection.
- Synchronous put failures abort and await rollback, including already-aborted transactions. Transaction completion promises settle on commit or abort, rather than reporting success or failure before the final transaction outcome.

Local saves wait for IndexedDB, not the cloud. Post-commit diagnostics cannot report an already durable write as failed. If queue-count diagnostics fail, the UI uses a conservative count until synchronization refreshes it. A session change can still reject an old caller after a commit; its completion never publishes into the new session.

## Verification

- `npm run lint`: passed
- `npm run typecheck`: passed
- `npm run test:coverage`: 100 tests in 14 files passed
- `npm run build`: passed
- `npm run check:bundle`: passed
- `npm run test:e2e`: 26 tests passed in Chromium and WebKit
- `npx vitest run --config docs/functional-code-audit/vitest.config.ts`: 8 tests passed
- `git diff --check`: passed

New mutation regressions force quota failures for Add, paired provider/charge creation, Edit, Delete, Undo, providers, ordering, settings, photo upload/removal and Restore. Each verifies unchanged state and disk, retries, and reloads the saved snapshot. Concurrent-patch tests verify publish-after-commit and failure recovery without losing unrelated fields. Cache tests cover initial and asynchronous open denial/blocking, a put failure after the snapshot write, and transaction abort/rollback. Browser tests inject quota failures into actual IndexedDB writes and verify Add/Edit form retention plus Delete/Undo retry behavior.

Testing exposed a double-abort path that could leave a transaction rejection unhandled; the commit path now tolerates an already aborted transaction and consumes rollback completion. The localhost browser server required sandbox escalation. One concurrent lint run raced Playwright deleting its generated test-results directory; lint was rerun after browser completion. No production account or data was used. Coverage percentages remain limited to the configured calculation modules.

The isolated audit suite now contains three passing regressions and five tests that intentionally demonstrate remaining defects; its green result does not mean the full audit is resolved.

## Limits and next step

Successful local save means the browser transaction committed; it does not guarantee cloud synchronization or prevent browser/site-data eviction. This change does not add cross-tab serialization, schema-level conflict resolution, general import schema validation or missing settings/calendar limits. Undo still uses its existing new-row identity behavior.

Next address audit Step 3: shared settings limits/enums and strict calendar validation so invalid input cannot enter and block the sync queue. Other production-readiness blockers in REPORT.md remain open.
