# Input validation — v4.3.6

Implemented on 9 October 2026. The checks below ran locally before publication. No manual deployment was performed.

## Changes

- Shared settings validation enforces budget and vehicle limits, theme/style/density enums and photo-path shape. Limits follow migrations 005 and 006.
- Calendar validation checks month lengths and leap years, rejecting dates such as February 30 rather than relying on JavaScript date rollover.
- The future-date allowance uses UTC consistently. Forms retain their existing today-only maximum and now have a 2000-01-01 minimum.
- Settings, providers and sessions validate raw values before rounding to PostgreSQL numeric precision. State, IndexedDB snapshots and queued payloads use the same rounded values. Rows whose energy and cost both round to zero are rejected.
- Live mutation, photo/settings mutation, migration and restore paths validate before their atomic local commit. Invalid legacy settings or matching sessions stop migration without marking it complete or clearing source data.
- Backup versions 1 and 2 use the shared settings rules; negative legacy budgets are rejected. Restore preview and merge normalize numeric values before duplicate-session comparisons.
- Vehicle and daily-allowance steppers stop at the server bounds in both styles. Controls have descriptive accessible names and preserve supported decimal precision. Add/edit fields include numeric limits and note length limits. Energy edits preserve three decimal places.
- Validation failures display the specific input error and preserve the form. Storage failures retain the separate storage-retry message.

## Verification

- Lint and TypeScript checks passed.
- 145 unit tests across 15 files passed, including calendar/leap-year boundaries, UTC midnight, settings bounds and enums, invalid legacy migration, backup validation, numeric precision, and rejected writes leaving state/storage/outbox unchanged.
- 32 browser regressions passed in Chromium and WebKit, including both vehicle styles at database bounds and invalid edits retaining input without queueing a write.
- Production build and bundle budget passed.
- Nine isolated audit checks passed: fixed calendar and negative-budget cases are now regressions. Duplicate backup providers, allowance-covered cost concentration and account route decoding remain deliberately reproduced defects. Date.parse rollover remains a language-behavior demonstration.
- Reported coverage still covers four calculation modules only; it does not represent application-wide coverage.

## Remaining work

Finish audit Step 3 by classifying permanent server rejection and providing correction/retry/discard for existing queued failures. Verify constraints and the database `current_date` timezone in a disposable Supabase environment; UTC is the client policy, not a verified production database setting. Then proceed to Step 4 backup identity, metadata, image-content and merge-semantics checks. This change does not repair already-invalid cached or queued records, cross-tab conflicts, or the remaining audit defects.
