# Step 9 — Maintenance and measured calculation reuse (v4.3.13)

## Changes

`ledgerSelectors.ts` owns the ledger summary previously embedded in `useEv`: chronological enrichment, descending rows, monthly/provider totals, lifetime totals and reference-rate basis. A two-level WeakMap caches each immutable session/provider array pair. Different consumers share the same calculated references; settings, photo, sync status, pending counts and error changes no longer invalidate these calculations. The metadata returned by `useEv` still updates normally. Replacing either input array invalidates the summary, and weak keys allow unused histories to be collected.

The cache requires the existing immutable state contract: replace arrays after domain edits instead of mutating them in place. The source search found no in-place mutations of these state/derived arrays in the current application. Regression tests verify identity reuse, source order preservation, allowance ordering, edit/provider invalidation and separation between input pairs.

`useRecords` receives only the fields the records engine consumes: sessions, providers, months, lifetime and budget. Its memoization also includes the current calendar month. Achievement playback, Vehicle records and Minimal Stats avoid a records-engine pass for appearance/sync-only changes; budget and calendar changes still update targets. A new month-boundary regression verifies a completed budget streak without a ledger edit. Home memoization similarly retains the current date so comparisons, daily allowances and projections update at their date boundary on the next render. This adds no midnight polling; it preserves refresh-on-render behavior.

Analytics now delegates Minimal Stats to `pages/analytics/CanvasStats.tsx` and Classic Trends to `pages/analytics/TrendsView.tsx`. Their small shared formatting helpers and metric type are explicit modules. The main Analytics file falls from 1,448 to 886 lines. The view extraction keeps existing imports synchronous inside the already lazy Analytics route; no new loading states, chart geometry, controls or visual behavior are introduced.

## Confirmed removable code

Removed the `.record-detail-close` rule, its focus rule and its Minimal override: no HTML/JS references remain after the shared Modal close control replaced them. The backdrop and record-card rules remain in use and are preserved. Removed the obsolete “future Supabase / Phase 4” provider comment and the moved view's orphaned section marker.

No assets or exported functions were deleted based merely on a missing text reference. Design prototypes, audit baseline artifacts and the independent untracked architecture directory are preserved. Larger Settings/Vehicle/data modules remain candidates for later incremental work; this pass does not attempt a full rewrite.

## Measurement

A local Node 25.9.0 benchmark bundled the selector with Rolldown and used 20,000 synthetic paid sessions. Five runs compared 20 fresh-array derivations with 20 lookups of an already calculated array pair:

| Run | Fresh-input derivations | Reused-input lookups |
| --- | ---: | ---: |
| 1 | 559.429 ms | 0.010458 ms |
| 2 | 547.399 ms | 0.019750 ms |
| 3 | 547.047 ms | 0.007584 ms |
| 4 | 549.382 ms | 0.008666 ms |
| 5 | 547.623 ms | 0.008167 ms |

These are synthetic selector timings, not end-to-end browser or mobile latency. Fresh arrays still require the full calculations; the benefit applies to metadata-only emissions and multiple consumers of the same input pair. The cache avoids those calculation passes; it does not suppress necessary React renders or make DOM-performance claims. The benchmark's temporary bundled file is outside the repository. Browser acceptance still uses the established suite.

## Verification and limits

277 unit tests pass; core coverage is 99.45% lines and 89.10% branches. All 90 development browser checks pass. Seven production checks pass, with the existing WebKit offline-entry case explicitly skipped for its engine-internal error. Lint, TypeScript, build and bundle budgets pass. Unit coverage includes the existing calculations, sync/restore lifecycle and records plus the new cache and calendar regressions. Production JS/CSS chunks remain inside the established 300/100 KiB budgets. View extraction is for maintainability; no bundle-size reduction is claimed. The largest UI chunk has less than 1 KiB headroom under its current budget, so future changes should keep the budget check enabled.

Step 7–8 external acceptance remains open: spreadsheet import/save/reopen, assistive technology and physical zoom, disposable Supabase RLS/storage/migration/Realtime, installed/managed Edge and deployed PWA upgrades. Cleanup does not establish production readiness or apply migration 008.
