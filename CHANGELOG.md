# EV Command — Changelog

## v4.3.14 (2026-10-10)
### Fixes
- Production reconnect checks now exercise automatic sync without requiring a retry button that successful recovery can hide.
- Added production CI failure annotations and HTML/trace artifacts; production checks still run when development browser tests fail.
- Recorded actual main-branch CI results and the remaining deployment/database acceptance gates.

## v4.3.13 (2026-10-10)
### Improvements
- Cached ledger summaries across hooks using immutable session/provider inputs, independent of sync and appearance changes.
- Limited record and Home calculation dependencies to ledger/budget/calendar inputs.
- Extracted Minimal Stats and Classic Trends views and consolidated their formatting helpers.
### Removed
- Removed unused legacy record-dialog close-button CSS and the obsolete future-Supabase comment.

## v4.3.12 (2026-10-09)
### Fixes
- Applied the shell cache policy to deep links while retaining immutable asset caching.
- Added isolated production-build validation with deployed-equivalent headers and Microsoft Edge projects.
- Fixed offline cold starts and unvisited deep links with a precached shell fallback, preserving network-first navigation.
- Added PWA cold-start, offline route, queued-write, worker replacement and missing-chunk recovery checks.
- Added settings to the Realtime publication and required the expected singleton row before acknowledging settings saves.
- Verified multi-page reads, later-page failures and private-photo download failures with repository regressions.

## v4.3.11 (2026-10-09)
### Fixes
- Patched all vulnerable brace-expansion and source-map-js resolutions without forced major upgrades.
- Hardened CSV fields against whitespace/control-prefixed and full-width formulas; quoted CR, LF and delimiter payloads.
- Shared native modal behavior across charge, edit, receipt, explanation, release, record and achievement dialogs, with keyboard containment, Escape, visible close controls and focus restoration.
- Associated charge/edit field labels, named the budget slider, and announced provider/color selections.
- Enabled viewport zoom, contained decorative lens overflow during enlargement, increased text-token contrast, added form/chart focus indicators and keyboard trend-chart controls.
- Made reduced-motion consumers react to preference changes and kept achievement messages open until dismissed.

## v4.3.10 (2026-10-09)
### Fixes
- Preserved recorded costs on fully allowance-covered charges in concentration charts; disclosed excluded non-energy charges.
- Compared completed matching months in consecutive years across analytics, and equal calendar-day ranges on Home.
- Included months without records in six-month charts and averages; disclosed current partial-month scope.
- Displayed each active network's daily allowance separately in both Savings styles and corrected aggregate Home labels.
- Removed invented default allowances from explanations and disclosed current settings, fallback reference rates and estimated savings.
- Added regression checks for gaps, unfinished periods, zero baselines, multiple networks and cost reconciliation.

## v4.3.9 (2026-10-09)
### Fixes
- Removed redundant account name decoding; new account links use stable provider IDs and survive renames while legacy name URLs remain supported.
- Added page error recovery for render and lazy-import failures with Home and reload actions.
- Kept the Minimal vehicle photo input mounted across views; added removal and shared busy, error and retry handling for both styles.
- Made explicit charger order take precedence over allowance grouping and persist through sync/reload.
- Restored original charge UUIDs and creation timestamps on Undo; repeated Undo preserves an existing row.
- Preserved the existing database creation timestamp through reads, writes and backups; same-day allowance allocation and history use creation time then UUID consistently.
- Added regression checks for special-name links, rename recovery, photo failures/reloads, paid-before-free order, Undo identity and stable receipt allocations.

## v4.3.8 (2026-10-09)
### Fixes
- Shared backup preflight and merge planning reject duplicate identities, broken references and incomplete or invalid photos.
- Preserved UUIDs, repeated charge multiplicity and archived/order metadata; existing matched rows retain current values.
- Made v1 budget/photo preservation and v2 settings/photo replacement or deletion explicit in preview and results.
- Validated image encoding, bounded containers and browser decoding; photo download failures prevent incomplete exports.
- Added worker-based file validation, offline fallback, progress and repeat-confirmation guards; restores remain atomic and retryable.
- Enforced a 15 MB/25,000-charge ceiling on imports, exports and merged ledgers after browser scale testing; guarded account changes while reading files.
- Bounded tall vehicle image resizing as well as wide images.

## v4.3.7 (2026-10-09)
### Fixes
- Preserved server error codes/status and held invalid, conflicting or unauthorized queue revisions for review.
- Allowed independent writes to sync while rejected prerequisites retain their dependent writes.
- Added correction forms, explicit retry and recovery downloads in Settings.
- Required confirmation to discard all pending changes; archived the local snapshot and queue atomically before restoring cloud state.
- Guarded rejection/recovery against stale revisions, concurrent edits and account changes; upgraded IndexedDB without losing existing writes.
- Verified settings writes return a matching owner row before acknowledging success.

## v4.3.6 (2026-10-09)
### Fixes
- Shared settings bounds and enums across live saves, legacy migration and v1/v2 backup parsing.
- Rejected impossible calendar dates and used a consistent UTC future-date boundary.
- Normalized numeric values to schema precision before committing state and queued writes; rejected charges that round to zero.
- Bounded vehicle and allowance controls, added date/numeric/note form limits and accessible stepper names.
- Added validation, durable write rejection and browser boundary regression tests.

## v4.3.5 (2026-10-09)
### Fixes
- Published mutations only after atomic IndexedDB commit and returned save failures to callers.
- Serialized local writes and remote snapshot adoption to preserve concurrent edits.
- Saved new charger/charge pairs and backup merges atomically; kept failed forms and Undo available for retry.
- Added visible save errors for settings and other quick controls, separate from cloud sync errors.
- Made optional localStorage access safe and allowed IndexedDB initialization to recover after errors or blocked opens.
- Added regression tests for storage failures, transaction rollback, concurrent saves and browser form retries.

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
