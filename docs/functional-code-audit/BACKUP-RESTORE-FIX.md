# Backup and restore reliability — v4.3.8

**Performance follow-up (10 October 2026):** v4.3.16 expands the benchmark with CPU throttling, separate worker/offline paths, dense Notes, durable snapshot/queue/reinitialization assertions and timer-delay measurements. Dense 25,000-row saves take about ten seconds under the diagnostic throttle and can stall the main thread for about two seconds. See [current performance results](IMPORT-PERFORMANCE-ACCEPTANCE.md). Physical-device acceptance remains open; older measurements below are historical.

Implemented locally on 9 October 2026. This step changes backup validation, merge semantics and file handling; it does not approve the deployed Supabase configuration.

## Restore contract

- Validate JSON byte size, versions, runtime fields, shared numeric/date/settings limits and referenced chargers before preview or mutation. Reject duplicate charger IDs, trimmed case-insensitive names, charge IDs and ambiguous matches against the current ledger. UUID comparison uses lowercase canonical values.
- Match chargers by UUID first, then normalized name. Matched chargers retain their current colour, allowance, archived status and order. New chargers retain backup metadata; preserve original order on an empty ledger and append in backup order otherwise. Legacy IDs receive new UUIDs; valid imported UUIDs are preserved.
- Keep existing same-ID charges unchanged and report differences. Content matches use a multiset rather than a set, preserving repeated identical charges within a backup and consuming each current row at most once. Reserve same-ID matches before content matching so import order cannot collapse legitimate rows.
- Version 1 restores budget only and preserves the current preferences, vehicle assumptions and photo. Version 2 restores all settings; a photo replaces the current photo and explicit null removes it. A v2 file referencing a photo without including it is rejected as incomplete. Raw JSON cannot spoof internal legacy provenance.
- Preview and save use the same planner. Save recomputes against current state inside the serialized write boundary. Rows, settings, photo state and queue operations commit in one IndexedDB transaction. A failed commit leaves the existing ledger intact and the preview available for retry.
- Account changes during file reading, photo verification or between preview and confirmation reject stale work. Display added, matched and conflicting counts separately, describe settings/photo behavior before confirmation, and distinguish a local save from pending cloud sync.

## Photos and file handling

Accept canonical base64 PNG, JPEG and still WebP only, up to 5,000,000 decoded bytes, 8,192 pixels per dimension and 16,000,000 pixels total. Validate MIME/signatures, container bounds and dimensions before decoding; PNG also validates chunk checksums. Browser decoding verifies actual pixel content and releases ImageBitmaps. SVG, arbitrary MIME types, corrupt encodings, truncated containers and oversized images are rejected before any photo queue operation. Container checks follow the [PNG specification](https://www.w3.org/TR/png-3/) and [WebP RIFF specification](https://developers.google.com/speed/webp/docs/riff_container).

Vehicle image compression now bounds both height and width to 960 pixels. Backups must include a referenced vehicle photo: download failure or an unavailable uncached photo offline prevents the export instead of silently omitting it. Cached complete photos remain available for offline export.

Read files in a module worker when online and supported, terminate it after completion/failure and show progress through validation, photo checking and preview preparation. Offline or unsupported-worker browsers use local reading. If Blob/File.text fails, FileReader provides a fallback. Large offline validation can occupy the main thread; progress does not imply background parsing on that fallback path. Failed reads and worker errors remain visible. Controls prevent repeated imports, downloads or confirmations while busy.

Both file and canonical merged/exported JSON must fit 15,000,000 UTF-8 bytes; arrays also have ceilings of 10,000 chargers and 25,000 charges. These are simultaneous limits, not a promise that every 25,000-row ledger fits: UUIDs, notes and photos consume bytes. Preview rejects an oversized merged ledger before confirmation. Restore repeats the check before committing.

## Verification

Regression coverage includes v1/v2 provenance, duplicate identities and references, unchanged same-ID conflicts, legacy mappings, archived/order metadata, repeated identical rows, repeated restore, explicit photo deletion, malformed images, browser raster decoding, UTF-8 size bounds, read errors, account changes and atomic quota failures with retry. Existing sync-rejection correction/retry and durable-save suites continue to run.

- Lint, TypeScript, production build and bundle budgets pass.
- 229 unit tests in 20 files and 9 isolated audit regression checks pass.
- 46 browser regressions across Chromium/WebKit and 2 scale checks pass. Backend calls use an isolated fake owner/service; no production ledger writes occur.
- Coverage gates pass (99.44% lines, 87.41% branches) for the four existing calculation modules; this is not backup module coverage.

Desktop browser measurements include worker startup, full preview, durable snapshot/outbox writes and pending-queue reload. They ran alongside the regression workload with no CPU throttle. Values are milliseconds, single samples; they do not establish physical-device memory limits.

| Browser | Charges | Read/worker | Preview | Restore/real IndexedDB | Result |
|---|---:|---:|---:|---:|---|
| chromium | 1000 | 327 | 4 | 42 | Saved |
| chromium | 10000 | 79 | 31 | 908 | Saved |
| chromium | 25000 | 82 | 78 | 4643 | Saved |
| chromium | 25001 | 23 | 0 | 0 | Rejected before preview |
| webkit | 1000 | 45 | 4 | 45 | Saved |
| webkit | 10000 | 40 | 21 | 471 | Saved |
| webkit | 25000 | 80 | 43 | 1109 | Saved |
| webkit | 25001 | 20 | 0 | 0 | Rejected before preview |

An earlier 90,000-row sample took 18,926 ms for Chromium restore and 4,177 ms for WebKit; the former 100,000-row compact sample expanded beyond the canonical 15 MB bound. The charge ceiling is now 25,000 rather than 100,000. Existing over-limit data is never deleted or truncated; attempts to export/restore it return a validation error. Confirm this tradeoff against any unusually large live ledger before release.

Repeat scale checks separately with `npm run test:e2e -- --config docs/functional-code-audit/backup-benchmark.config.ts`. The benchmark writes measurements to `/tmp/ev-backup-chromium.json` and `/tmp/ev-backup-webkit.json`. Workers run serially in this dedicated configuration; final results here came from the combined run.

Playwright WebKit network-offline mode made both File.text and FileReader reject local in-memory files with “The I/O read operation failed.” WebKit restore cases therefore simulate navigator offline and block backend requests while leaving local file I/O available. Chromium cases use actual context network-offline mode. This distinction is a test limitation, not evidence that physical Safari offline file import is verified.

## Remaining acceptance work

The physical low-end/mobile-device memory and latency gate is not certified by desktop runs. Microsoft Edge, production service-worker lifecycle and live Supabase storage/RLS rejection behavior remain separate checks. The Step 3 disposable Supabase/timezone acceptance work and cross-tab upload coordination remain open. Step 5 addresses account route decoding, Minimal photo controls, explicit charger order and Undo identities.
