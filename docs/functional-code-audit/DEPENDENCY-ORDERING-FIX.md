# Sync dependency ordering — v4.3.4

Implemented on 9 October 2026 for M5 in REPORT.md. The checks below ran locally before publication; no manual deployment was performed.

## Behavior

- Provider upserts precede session writes. A session waits while its provider has a pending upsert, including a replacement queued during the original upload.
- Photo uploads precede settings that reference their path. Settings clearing or replacing a photo reference precede removal of the old photo.
- Ordering uses operation types and explicit entity/path prerequisites. Artificial timestamp offsets have been removed from upload, removal and legacy photo migration.
- Before sending each operation, the queue reads its current revision and prerequisites together in a readonly IndexedDB transaction. Deleted or replaced candidates are skipped, and newly queued prerequisites defer dependent operations to the next pass. The existing revision acknowledgement and session guards remain in effect.
- A failed prerequisite stops the current batch, leaves dependent operations durable, and retains the existing visible sync-error/retry behavior.
- Contradictory records that reference and delete the same photo produce an actionable error and stay queued, rather than allowing destructive ordering or a retry loop.

The planner sorts one batch in O(n log n). Each candidate adds one readonly transaction with at most two keyed lookups; it does not rescan or clone the full queue for every upload. This adds local read overhead to protect correctness while keeping batches finite. Broader independent-operation error handling remains unchanged.

## Verification

- `npm run lint`: passed
- `npm run typecheck`: passed
- `npm run test:coverage`: 79 tests in 13 files passed
- `npm run build`: passed
- `npm run check:bundle`: passed
- `npm run test:e2e`: 20 tests passed in Chromium and WebKit
- `npx vitest run --config docs/functional-code-audit/vitest.config.ts`: 8 tests passed
- `git diff --check`: passed

Eleven new integration tests use a fake backend that rejects sessions without their provider, settings referencing an absent photo, and deletion of a referenced photo. They cover reversed/equal timestamps, each prerequisite failing then retrying, latest-provider replacement during upload, upload-to-remove and remove-to-upload races, and contradictory photo operations. Typecheck caught a union-type construction in a test fixture; the fixture now uses the typed mutation factory, and final checks passed.

The existing audit reproductions still deliberately demonstrate seven unrelated defects. Coverage percentages apply only to configured calculation modules. No production account or Supabase data was used.

## Limits and next step

Dependency checks describe the queue at the local read transaction. They cannot lock the server through an upload, serialize other tabs/devices, repair malformed imports, or revoke requests already in flight. No database schema or cache schema changes are required; legacy queue entries retain their payloads and receive the existing revision migration when listed.

The core C1 acknowledgement, C6 session lifecycle and M5 dependency fixes are now implemented, with cross-tab conflict management still open. Next address audit Step 2: truthful durable saves, visible and recoverable IndexedDB failures, safe optional localStorage mirroring, and callers that wait for save outcomes.
