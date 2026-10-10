# Two-build PWA upgrade acceptance (v4.3.20, 10 October 2026)

## What changed

The prior worker replacement check modifies a comment in `sw.js` while retaining the same asset manifest. It remains useful but does not establish recovery when a new release removes an old lazy chunk.

Production validation now builds fixtures A and B from the current application using its normal Vite/PWA configuration. A test-only transform adds build markers to the entry, Settings and Statement modules. This produces distinct module hashes, precache entries and generated workers. The markers exist only in ignored `dist-validation/a` and `dist-validation/b`; the ordinary shipping build never loads the test transform. These are two synthetic release variants of the current source, not historical releases or a schema migration.

The loopback validation server switches between the two complete asset directories. After switching to B it returns 404 for A-only assets; it does not merge directories or retain old chunks. Every production test starts on A with fresh fake backend data. The existing single-worker production runner prevents concurrent server revision changes.

## Upgrade regression

1. Load A and import Home and Settings, leaving Statement unimported in the running page. Require an active controlling worker.
2. Fail the fake backend and save budget 75. Require an error badge and exactly one durable operation. Capture its ID, owner, action, payload and revision.
3. Switch the server to B. Confirm the old Statement asset returns an actual server 404. Update the worker and require controller replacement and removal of the old Statement precache entry.
4. Require the open document still identifies A. In Chromium/Edge explicitly evict the separate HTTP cache and disable it for this page, then open Statement. WebKit exercises the case without a CDP cache change. Require the recovery UI for the missing old lazy module and unchanged pending operation identity.
5. Use Reload app. Require entry and Statement markers B, a usable route and no recovery heading. Open Settings and require budget 75 and the same queued mutation ID/revision/payload.
6. Restore backend availability and Retry sync. Require a synced badge, empty durable outbox and fake backend budget 75.

The first Chromium trial opened the old route successfully: its immutable HTTP cache retained A's asset even after the service worker removed the old precache entry. That is a valid cached-asset path, not a production failure. Cache eviction makes the removed-asset condition explicit. The existing missing-chunk and worker-only checks remain separate; genuine error assertions were not suppressed or retried.

## Run and limits

```sh
npm run test:production -- --project=chromium --project=webkit
# On an installed Edge host (also included in CI):
npm run test:production -- --project=msedge
```

This test uses generated fixtures, a local fake backend, a loopback server and deployed-equivalent headers. It does not certify actual CDN rewrites/asset retention, standalone installed-app launch, browser-process restart, managed Edge restrictions, device storage pressure, older released application schemas or live backend behavior. No deployment or database migration was performed. Disposable Supabase acceptance remains removed from the active plan at the user's request and not performed.

The latest checked v4.3.19 [CI run](https://github.com/dailoclaw/ev/actions/runs/38030827763) was still running during this step; no passing result is claimed. v4.3.18 passed both CI jobs. This v4.3.20 change has not been pushed or run remotely.

## Final local verification

The full final Chromium/WebKit production suite passes nine tests with one pre-existing WebKit offline-navigation skip. This includes CSP/lazy routes/backup worker, worker-only replacement, distinct-build recovery and missing-chunk handling. Lint, TypeScript, production build, bundle budgets, script syntax and whitespace checks pass. Both fixture Statement chunks have different hashes; the ordinary `dist/assets` contains no fixture marker code. Application business logic is unchanged apart from release metadata, so unrelated unit/development suites were not rerun for this test-fixture change. Edge coverage is configured for CI but was not run on this host. Changes are prepared locally and not pushed.
