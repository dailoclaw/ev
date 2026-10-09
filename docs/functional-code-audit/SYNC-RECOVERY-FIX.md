# Sync rejection recovery — v4.3.7

Implemented on 9 October 2026. The checks below ran locally before publication. No manual deployment was performed.

## Behavior

- Preserve PostgreSQL/PostgREST codes, HTTP status and Storage error fields rather than flattening every rejection into a message. Known invalid-input, authorization and conflict failures are held for review. Unknown/network/rate-limit/server failures remain retryable.
- Persist rejection details only against the exact owner and queue revision that failed. A newer correcting write replaces the held revision and clears its rejection. Old failed responses cannot mark newer edits rejected.
- Continue sending independent writes after invalid/conflict failures. Retain their blocked dependants. Stop the current batch on authorization denial; do not repeatedly upload held revisions on lifecycle/realtime sync events.
- Show rejected writes in Settings, including their server messages and correction routes. Provide labeled correction forms for charger details and complete settings; charges use the existing History editor, and photo changes use Vehicle. Missing local entities can be retried or discarded; the forms do not invent replacement identities.
- Explicit retry clears held metadata with revision/owner guards and retries the current queue. Authorization failures require the owner permissions/sign-in problem to be resolved first.
- Require a matching returned owner row before acknowledging settings updates, so a filtered/RLS update that affects no owner row is not mistaken for success.

## Discard semantics

“Discard all pending changes” explicitly covers the entire current owner's queue, including blocked dependants. The UI names this scope and requires confirmation. It does not roll back changes already accepted by the server.

Recovery captures the intended queue revisions, waits for the active sync request, pauses new sync dispatch, serializes local writes, fetches the current cloud ledger and atomically:

1. Checks the pending operation IDs/revisions and cached owner still match.
2. Archives the local snapshot and all discarded operations, with their rejection details.
3. Replaces the local snapshot with cloud state and removes only that owner's matching pending operations.

Storage failure, account change or stale/new queue revisions abort this transaction. Later local edits wait behind recovery and apply to the restored state. Other owners' queued changes and recovery archives are preserved. Archive creation and queue deletion share one transaction, so quota failure cannot delete unarchived writes.

The owner can download pending changes and archived snapshots as a recovery JSON file. This file is for review/manual recovery, not standard backup import. Archives persist across reload/sign-out until browser storage is cleared. Clearing browser data removes those copies; the UI tells users to download them first.

## Storage and UI

IndexedDB upgrades from version 1 to 2 by adding a recovery store without replacing existing snapshots or pending writes. Archives have an owner index, so startup counts do not load entire archived ledgers/photos. Downloading all archives can be large; storage quota failure is surfaced and rolls back discard. No archive is silently purged to make space.

The recovery panel supports both app styles, uses associated labels and fieldsets, bounds numeric fields and provides visible focus indicators. Busy actions prevent duplicate recovery requests, and open correction forms disable discard/retry until saved or cancelled. Empty ledgers with rejected writes or archives retain access to Settings instead of being trapped behind the initial-load error gate.

## Verification

- Lint, TypeScript, 190 unit tests across 17 files, production build and bundle budget passed.
- 38 Chromium/WebKit regressions passed, including rejection persistence after reload, settings/charger correction, explicit discard cancellation/confirmation and recovery download after reload.
- Unit regressions cover independent writes versus rejected prerequisites, transient/auth/conflict/invalid classification, explicit retry, stale failure versus newer correction, owner-scoped archives, archive rollback, schema upgrade, concurrent edits during recovery and sign-out during cloud fetch.
- Nine isolated audit checks passed; unrelated deliberately reproduced defects remain open.
- Coverage reporting still covers four calculation modules, not the full application or these recovery modules.

## Remaining production checks

No disposable Supabase environment was exercised. Verify SQL constraints, owner RLS, zero-row settings updates, authentication expiry, Storage rejection codes and the server `current_date` timezone against an isolated database before declaring the full audit Step 3 gate complete. Existing cross-tab synchronization has no upload lease; revision guards prevent deleting newer queue writes, but another tab may already have a server write in flight. Cloud changes accepted elsewhere are not rolled back by discard.

Next implementation stage: audit Step 4 backup/restore identity, metadata, photo validation and merge semantics. The audit's route decoding, cost concentration, Minimal photo controls and other outstanding defects are not fixed by this change.

Classification follows the documented [PostgREST error structure and mappings](https://docs.postgrest.org/en/latest/references/errors.html) and [Supabase Storage error fields](https://supabase.com/docs/guides/storage/debugging/error-codes). Unknown errors are deliberately kept retryable.
