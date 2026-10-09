# Step 8 — Production validation (v4.3.12)

## Implemented locally

- Added `msedge` projects to development and production Playwright configs. CI installs the branded Edge channel alongside Chromium/WebKit and runs both suites. This host has no Microsoft Edge installation, so its actual channel and managed-device policies remain unverified here. [Microsoft's Playwright guidance](https://learn.microsoft.com/en-us/microsoft-edge/playwright/) documents the branded channel.
- Added a separate production build in ignored `dist-validation/`, using only an isolated local in-memory Supabase-shaped API and fake owner credentials. The validation server reads CSP/security/cache headers from `vercel.json`; deep links now receive the same non-storing shell cache policy, with explicit immutable asset overrides; no production data, credentials, external project or deployment is used. The server binds to loopback and is a test fixture, not a hosting implementation.
- Tests cover every lazy page, the backup Web Worker under CSP, missing-chunk recovery through the existing error boundary, worker replacement in an open tab, durable outbox preservation and successful retry. Missing assets return 404 in the fixture; the hosting provider's exact rewrite/CDN behavior still requires deployed acceptance.
- Reproduced an offline cold-start failure: before any controlled navigation is cached, and for unvisited deep links, NetworkFirst had no fallback. Added `precacheFallback: { fallbackURL: '/index.html' }` to its navigation strategy. Online navigation stays network-first; offline requests can use the precached shell and chunks. See [Workbox build options](https://developer.chrome.com/docs/workbox/modules/workbox-build).
- Added an idempotent migration `008_settings_realtime.sql`. The client already subscribes to settings changes, but previous migrations published only sessions/providers. The new migration publishes settings without changing owner policies. It has not been applied to a database in this turn.
- Settings writes now require both `id === 1` and the expected `owner_id` before acknowledgement. Tests cover null/wrong-owner/wrong-id results, 1,201 ordered session reads over three pages, later-page failures and failed private-photo downloads. Existing tests cover edits/deletes during an in-flight upload and photo/settings dependency failures.

## Local verification results

- 274 unit tests pass; core coverage is 99.45% lines and 88.42% branches.
- 90 development browser checks pass across Chromium and WebKit.
- Production: seven checks pass; one WebKit offline-entry case is explicitly skipped after a repeated engine-internal navigation error. Chromium passes the new-window offline test. No Edge run was performed on this host.
- Lint, TypeScript, production build and bundle budgets pass; npm audit reports zero vulnerabilities.
- Migration 008 is prepared but unexecuted. No real database/storage/Realtime or deployed/installed-PWA gate is claimed.

## Reproducible checks

```sh
npm run test:coverage
npm run lint
npm run typecheck
npm run build
npm run check:bundle
npm audit --audit-level=high
npm run test:e2e -- --project=chromium --project=webkit
npm run test:production -- --project=chromium --project=webkit
```

On an installed Edge host run both suites with `--project=msedge`. CI installs Edge automatically; enterprise machines should use their managed browser installation.

Playwright WebKit reports an internal navigation error when starting the controlled page offline, even with the local API. That case is explicitly skipped for WebKit and remains an installed-Safari manual check; Chromium runs it normally.

The production worker-replacement fixture changes the worker's response bytes while keeping the same precache manifest. This verifies activation/claim and queue survival, not a complete old-build-to-new-build CDN upgrade. Offline entry uses a newly opened browser page in the same profile, not a standalone installed-app launch or a browser-process restart. Browser engines, automation routing and OS reachability indicators can differ; outbox assertions inspect durable IndexedDB entries directly. A local backend is used because service-worker fetches may bypass browser request interception.

## Disposable Supabase acceptance — still required

No disposable project or test credentials were supplied. Docker is unavailable on this host, so the local CLI cannot launch its Supabase stack. Do not run this against the personal/live ledger.

1. Create an empty disposable project and verify its reference. Apply migrations 001, 002, 004, 005, 006, 007 and 008 in order (there is no migration 003). Record SQL errors; do not skip them or modify historical migrations to conceal an error.
2. Create two disposable Auth users. Bind `app_settings.id = 1` to the owner UUID using the administrative database connection; do not expose a service-role credential in the client build.
3. With the anon key and no session, request every application table/view and private photo object. Require denial or zero visible rows; verify attempted writes did not change owner data.
4. Sign in as the non-owner. Repeat select/insert/update/delete tests, including a settings update requesting a returned row. Denial/empty-result responses must not change the owner's rows. Verify the client retains a zero-row settings write for review instead of acknowledging it.
5. Sign in as the owner. Insert/update a provider, insert/edit/delete a charge, update settings and read the private photo. Require returned settings row `{ id: 1, owner_id: <owner UUID> }`. Verify invalid dates, negative/out-of-range values, enum values and foreign keys are rejected by database constraints.
6. Upload a valid raster to `<owner UUID>/vehicle.jpg`. Confirm bucket `vehicle-photos` is private, anon/non-owner downloads fail, the owner cannot upload outside their owner folder, and oversized/unsupported-type files fail. Interrupt an upload; verify the settings path is not acknowledged before the photo exists and the durable queue remains retryable.
7. Query `pg_publication_tables` and require providers, charging_sessions and app_settings in `supabase_realtime`. Open two signed-in owner clients; edit each table in one and observe the other without reload. Confirm the non-owner receives no private row payloads.
8. Insert more than 500 disposable sessions, with duplicate dates/timestamps but unique IDs. Confirm complete stable page order, equal receipt/export totals and no truncation. During a paginated reload insert/delete/edit rows from the other client; compare the final ledger against a canonical database read. Offset pagination is not a transaction snapshot, so mutation during paging remains a specific risk to assess; the local static-page test does not certify it.
9. Delete the disposable fixtures/project after capturing results. Record browser version, migration versions, results and any limitations; do not put credentials or private payloads in this repository.

## Deployed/installed acceptance — still required

1. On a preview deployment, inspect actual document/deep-link/chunk/SW headers. Confirm CSP, correct MIME types, no runtime exceptions and usable lazy routes/backup worker. Check that deep-link shell responses are revalidated rather than served stale by CDN/browser caching.
2. Install the PWA on Chrome and managed Edge. Start it cold online, then offline on visited and unvisited routes. Create a charge, close the application, reopen offline and verify the durable queue. Reconnect and verify exactly one cloud row and an empty acknowledged queue.
3. Keep an older build open with a queued write, deploy a new preview release, trigger worker update and navigate to an unloaded lazy page. Confirm recovery, no update/reload loop and no queued-write loss. Test with a genuinely removed old chunk as well as retained CDN assets.
4. Check managed Edge policies, storage restrictions, install permissions and offline behavior on the target device. Record manual results separately from Chromium-engine automation.
5. Complete Step 7's outstanding Excel/LibreOffice, screen-reader and physical zoom checks before production approval.

Step 8's full production gate remains open until these external checks pass. Local tests alone do not establish production readiness.
