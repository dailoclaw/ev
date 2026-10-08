# Session lifecycle fix — v4.3.3

Implemented on 9 October 2026. This change addresses C6 in REPORT.md. The checks below ran locally before publication; no manual deployment was performed.

## Behavior

Each initialized account session owns a generation token and its own sync promise and retry flag. Sign-out, switching accounts and signing back into the same account invalidate the previous generation. Authentication notifications invalidate work immediately, before React processes the new auth state. An initial auth lookup cannot overwrite a later auth notification.

Initialization checks the generation after cache and queue reads before publishing data or attaching Realtime. Account switching clears the visible ledger immediately. Sign-out removes the Realtime channel, clears the reload timer, and leaves signed-out state unchanged when offline events or old channel callbacks arrive.

The upload loop checks the session before starting each operation, after its completion, and after acknowledgement. Stale operations remain queued for an idempotent retry. Old sync completion and failure handlers cannot publish data, errors or counts, reset the new session's sync promise, or request its follow-up sync. New sessions can synchronize while an old request remains pending.

Repository pagination and photo downloads check the generation between asynchronous stages. Settings reads explicitly select the expected owner, and results and queued operation ownership are checked. Backup captures one snapshot and rejects if the session changes during a photo download. Restore checks the session after its final cache commit before reporting completion or scheduling sync.

## Verification

- `npm run lint`: passed
- `npm run typecheck`: passed
- `npm run test:coverage`: 68 tests in 12 files passed
- `npm run build`: passed
- `npm run check:bundle`: passed
- `npm run test:e2e`: 20 tests passed in Chromium and WebKit
- `npx vitest run --config docs/functional-code-audit/vitest.config.ts`: 8 tests passed (seven still intentionally demonstrate other unresolved audit findings)
- `git diff --check`: passed

New deterministic regressions pause initialization, queue reads, uploads, remote responses and persistence completion; then sign out, switch accounts, or reauthenticate the same owner. They also verify new-owner sync progress during an old upload, signed-out browser events, backup isolation, pagination cancellation, foreign-owner rejection and changed-session photo failures. A browser test signs out through the actual auth/UI path during a paused sync, resumes the responses and verifies signed-out state with no sessions.

The first browser run exposed a test setup error: Retry is available only after error/offline states. The test now creates an error state before retrying; the final full suite passed. Coverage percentages remain scoped to the configured calculation modules. All backend tests use isolated mocks; no production account or data was used.

## Limits and next work

Generation checks do not revoke a server request or IndexedDB transaction that already started. Such a request may finish; its stale completion is ignored and no later operation from that batch starts. Supabase RLS remains responsible for server authorization. Cross-tab conflict resolution and upload serialization are not implemented.

C1 and C6 are now addressed locally, but audit Step 1's full gate remains open: order provider/session and photo/settings dependencies explicitly (M5), and test those workflows. Truthful save failure handling, settings/date validation and the other audit blockers remain unchanged. Historical audit line references describe the original 4.3.1 source.
