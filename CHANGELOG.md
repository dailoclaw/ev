# EV Command — Changelog

## v4.3.4 (2026-10-09)
### Fixes
- Ordered provider/session and photo/settings synchronization by dependencies instead of timestamp offsets.
- Rechecked current queue revisions and prerequisites before upload to skip obsolete operations safely.
- Preserved dependent writes when prerequisites fail; contradictory photo operations report a recoverable sync error.
- Added constraint-aware backend tests for ordering, retries and changes queued during paused uploads.

## v4.3.3 (2026-10-09)
### Fixes
- Added session generation guards to cache initialization, synchronization, persistence completions, backup and restore.
- Invalidated old work immediately on authentication changes and removed its timers and Realtime subscription.
- Scoped sync scheduling to each session so a pending old request cannot block a new account.
- Guarded paginated reads and photo downloads, and checked remote settings and queued operation ownership.
- Added paused-operation regression tests for sign-out, account switching and same-account reauthentication.

## v4.3.2 (2026-10-09)
### Fixes
- Prevented completed uploads from removing newer queued edits or deletes by acknowledging the uploaded revision atomically.
- Upgraded existing pending offline operations in place without discarding their payloads.
- Added regression tests for paused uploads, replacement operations and legacy queue entries.

## v4.3.1 (2026-09-22)
### Fixes
- Updated Vitest and its coverage tooling to address the development-server file-read advisory.
- Updated fast-uri and js-yaml to patched releases in the development dependency tree.

## v4.3.0 (2026-09-22)
### New Features
- Added animated sync status marks for pending, syncing, synced and failed states.
- Added a subtle, read-only liquid gauge for today's free-energy allowance in both Savings styles.
- Refined history swipes with resistance, spring settling, mouse support and accessible action controls.

### Fixes
- Preserved vertical scrolling and cancelled gestures without triggering row actions.
- Made reduced-motion changes take effect immediately for the new interactions.
- Limited generated utility CSS to app sources so local design studies and test output do not inflate production bundles.

## v4.2.5 (2026-09-05)
### Existing release
- EV charging ledger with offline sync, savings, analytics, Classic and Minimal styles.
- Earlier release notes are maintained in `src/lib/changelog.ts`.
