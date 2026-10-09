# Visible functional fixes — v4.3.9

Implemented locally on 9 October 2026 for audit Step 5 (C5, M2, M6 and M8).

## Account navigation and recovery

Remove redundant decoding of React Router's name parameter. Percent signs, literal `%20`, Unicode and slash-containing legacy names render without throwing or being decoded twice. New links from Home, Accounts and Minimal Stats use `/accounts/id/:providerId`, so special names and later charger renames cannot change the selected account. Legacy literal `%2F` URLs use a guarded single decode of the raw URL segment to avoid React Router conflating them with slash names. Existing name routes remain available; a missing account gives a recoverable Not found screen with a named Back to accounts action.

Wrap the page outlet in an error boundary keyed by the complete route location. Render and lazy-import failures show a plain recovery screen with Home and reload actions. The primary navigation stays available, and changing routes clears the boundary. This boundary covers pages; it does not intercept event-handler errors or failures before the routed application mounts.

## Vehicle photos

Keep one Minimal photo input outside the conditional view branches. Overview and Distance pickers share that input, and removal is available when a photo exists. Both styles use a shared photo hook for compression, save, removal, errors and retry.

Busy guards cover file reading/compression as well as saving/removal, including same-tick repeated actions. Failed upload keeps the compressed image for retry; failed removal keeps the saved photo. Clear obsolete upload retries when the user chooses removal. Expose errors with role=alert in both styles. Catch canvas conversion exceptions and file-read cancellation. Compression completed after the page unmounts cannot initiate a new upload; in-progress uploads retain the data layer's account-session guards.

## Charger ordering

Stored `sortOrder` takes precedence over allowance grouping. Free-first and name ordering are fallbacks for equal/missing ranks. Moving a paid charger above a free charger now affects Settings and the charge picker, and survives cache reload and cloud synchronization. Archived chargers remain hidden from the picker.

## Undo and allowance allocation

Undo restores the original charge UUID, provider identity and creation timestamp. A renamed charger is resolved by its ID and the restored row uses its current name. Repeated Undo keeps an already-present row and its newer edits. A missing original charger rejects Undo instead of assigning another network. Atomic failure keeps the deleted state and Undo available for retry; the original queue key replaces a pending delete with the restoring upsert.

The existing schema already supplies `charging_sessions.created_at` (migration 001). Select that field, normalize it to UTC millisecond precision and preserve it on writes, backups and Undo. New charges receive a creation timestamp after the latest same-day charge for that provider, even when the local clock repeats or moves backwards. Validate optional imported creation timestamps; older backups without this field continue to load.

Allocation and history use one comparator: charge date, creation timestamp, UUID. Legacy/cache/import rows without a known timestamp use a fixed epoch and UUID tie-breaker; their writes explicitly persist that epoch so a recreated server row cannot acquire a later allocation position. Reading real creation metadata for the first time can change historical receipt attribution once after upgrading from an older version. Daily free-energy totals are unchanged by the ordering fix. UUIDs are a deterministic tie-breaker, not evidence of actual charging time.

No new schema migration is required. Real deployed-schema/RLS acceptance remains outstanding; local browser checks use an isolated fake backend and real IndexedDB.

## Verification

- Lint, TypeScript, build and bundle budgets pass.
- 246 unit tests in 21 files and 9 isolated audit checks pass.
- 64 browser regressions pass across Chromium and WebKit, with focused account-route reruns after the literal `%2F` legacy correction.
- Existing coverage gate: 99.45% lines and 87.7% branches for the four calculation modules.
- Browser checks cover both styles, real file-chooser interaction, failed photo save/removal retries, cache/cloud reloads, paid-before-free picker order, special-name and renamed account links, render/import recovery and Undo UUID/creation-time/receipt stability through offline edits and sync.
- Isolated audit browser checks retain the still-open receipt keyboard/focus reproduction and convert the Minimal photo-input reproduction to a passing regression. Coverage percentages apply to the existing four calculation modules, not the complete application.

## Remaining work

Step 6 addresses cost-concentration exclusions, matched comparison periods, missing months and multiple daily allowance providers. Live Supabase/storage/RLS checks, Microsoft Edge and production service-worker acceptance remain open from the broader audit. Cross-tab upload coordination is still a separate task; stable Undo identities prevent duplicate UUIDs but do not decide which of two conflicting tab edits should win.
