# Public deployment checks and asset rewrite fix (v4.3.21, 10 October 2026)

## Deployed results before the fix

The user supplied https://ev-navy.vercel.app for read-only acceptance. No sign-in, credentials, ledger reads, mutations, migrations or deployment commands were used. Checks used a fresh unsigned-in Chromium profile.

- v4.3.20 [main CI](https://github.com/dailoclaw/ev/actions/runs/38031177553) passed `verify` and `browser-smoke`, including branded Edge and production acceptance.
- `/`, `/settings` and `/sw.js` return 200 with the expected HTML/JavaScript content types, non-storing cache policy, CSP, HSTS and `nosniff` headers.
- The deployed shell and worker match the local v4.3.20 production outputs byte for byte.
- The worker manifest has 42 precache entries, including repeated includeAssets entries. All 39 unique entries return 200; JavaScript/CSS have correct MIME types and hashed assets carry the immutable policy. The web manifest returns its expected MIME type.
- The sign-in screen loads with no observed page errors, CSP violations or failed requests. A service worker becomes activated and controls the page.
- After going offline, an unvisited `/settings` deep link loads the cached sign-in shell. This is unsigned-in shell acceptance; it does not verify an authenticated ledger or an installed-app cold launch.

## Confirmed hosting defect

`/assets/nonexistent-audit-chunk.js` returns **200, `text/html`, `public, max-age=31536000, immutable`**. The catch-all rewrite converts a missing asset into the app shell while the asset header rule attaches long-lived caching. A removed chunk can therefore produce a MIME/import failure and leave incorrectly cached HTML at the old asset URL. The local fixture previously returned 404 through a hardcoded asset check, concealing this difference from the real host.

The fix excludes `/assets/` from the SPA rewrite using Vercel's [documented capture-group negative lookahead syntax](https://vercel.com/docs/project-configuration/vercel-json). Existing static assets retain normal filesystem handling and immutable caching. Route fallback still applies to app URLs, including dotted account names; the rule does not exclude all paths containing a period.

The validation server now applies `vercel.json` rewrites when a file is missing instead of imposing its own asset/extension exclusions. Production checks require missing JS/CSS to return 404 and a dotted account route to receive non-storing HTML. Existing two-build upgrade, stale-chunk recovery, CSP, offline queue and retry tests remain enabled.

## Acceptance still open

The v4.3.21 fix is local, not pushed or deployed. After publishing it, repeat actual missing JS/CSS requests against the public URL and require 404, then confirm valid hashed assets and deep links still work. Local routing tests are not proof that a hosting-provider configuration has been applied.

Installed/managed-browser launch, signed-in offline write/reconnect, a real deployed release upgrade, actual screen-reader/zoom/Excel UI acceptance and target-device large-import performance remain manual. Disposable Supabase acceptance remains removed from the active plan at the user's request; live RLS/storage/Realtime and migration behavior are unverified.

## Final local verification

The v4.3.21 production suite passes nine Chromium/WebKit checks with one pre-existing WebKit offline-navigation skip. Missing JS/CSS return 404, dotted account routes return non-storing HTML, and two-build recovery preserves pending-write identity and retry. Lint, TypeScript, production build, bundle budgets, server-script syntax and whitespace checks pass. Business logic is unchanged apart from release metadata; unrelated unit/development suites were not rerun for this hosting/configuration change. Edge coverage is configured but requires remote CI. No push or deployment was performed during these checks.
