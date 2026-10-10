# Functional Code Check — EV Command 4.3.1

**Latest completed CI and local follow-up:** v4.3.17 passed both main CI jobs. v4.3.18 removes unused signature work and adds phase measurements; the dominant dense-import atomic-write delay remains. See [current phase profile and validation](IMPORT-PHASE-PROFILE.md). Manual/device acceptance limits remain open.

**Latest follow-up:** v4.3.17 reduces large-write submission stalls while preserving atomic rollback. An intermittent WebKit production failure recurred in v4.3.15 CI; route readiness checks were strengthened and remote verification remains required. See [responsiveness fix and CI evidence](IMPORT-RESPONSIVENESS-FIX.md). Earlier status paragraphs retain their release-specific scope.

**Current acceptance status (10 October 2026):** v4.3.14 main CI passes both jobs. v4.3.15 records LibreOffice CSV round-trip and focused accessibility results; Excel, independent screen-reader and physical zoom checks remain open. Disposable Supabase validation is removed from the active plan at the user's request and recorded as not performed, with live backend behavior unverified. See [current acceptance results](CSV-ACCESSIBILITY-ACCEPTANCE.md). Older findings and plan entries below retain their historical scope.

Audit date: 8 October 2026, Australia/Adelaide. This is a review of the workspace as inspected, not an approval of the deployed database. Application source was not modified. Audit evidence and reproduction checks are saved alongside this report.

## Executive Summary

| Assessment | Verdict |
|---|---|
| Overall assessment | **Fair** |
| Estimated technical debt | **Medium**, concentrated in persistence and UI behavior |
| Production readiness | **Not Ready** for production approval |
| Architecture score | **6/10** |

The application has useful separation between calculations, repository I/O, browser persistence, and page components. Strict TypeScript, ESLint, pure calculation tests, lazy routes, database constraints, and owner-only policies are strong foundations. However, a ledger must reliably preserve edits. The outbox can lose a newer operation when an older upload completes, failed durable writes are swallowed, and invalid settings can block every later queued write. These defects outweigh passing happy-path checks.

Eight focused unit reproductions and two Chromium reproductions confirmed existing defects. These tests intentionally assert the **current faulty behavior**; a passing reproduction is evidence of the bug, not evidence of correctness. They are excluded from the normal test suite. Convert them to assertions of desired behavior during fixes.

### Scope and evidence

Reviewed all production TS/TSX files under `src`, production HTML/JS entry points, CSS behavior relevant to findings, build/PWA/security configuration, migrations, and existing tests. Scanned 94 HTML files, including design prototypes and the architecture document; 52 executable inline script blocks had no parser syntax errors. Prototype interactions were not exhaustively exercised. Historical mockups are not application routes.

| Check | Result | Limits |
|---|---|---|
| `npm run lint` | Passed | Does not validate arbitrary inline HTML scripts or all runtime paths |
| `npm run typecheck` | Passed | Does not validate JSON, storage data, or remote schema at runtime |
| `npm test` | 38 tests passed in 9 files | No orchestration race tests in the existing suite |
| `npm run build` | Passed | Syntax/import/build check, not functional proof |
| `npm run check:bundle` | Passed | Largest JS chunk ~248.55 kB; main CSS ~92.12 kB, uncompressed |
| `npm run test:coverage` | Passed; lines 99.44%, branches 87.41% | Coverage gate includes **only four modules**: savings, records, cost anatomy, year on year |
| `npm run test:e2e` | 18 passed across Chromium/WebKit | Vite development server, fake backend; no real RLS/storage or production service worker |
| Focused audit checks | 8 unit + 2 Chromium reproductions passed | Confirm specific faulty behavior |
| `npm audit --json` | **Failed: 2 high-severity package findings** | First network attempt failed; retry reached registry successfully |
| HTML inline JS parsing | No syntax errors in 52 blocks | Not a full HTML conformance validator; inline handler attributes not separately parsed |

No production credentials were used for browser checks and no remote ledger records were changed. Live RLS installation, owner binding, storage policies, deployed CSP, Microsoft Edge, screen readers, and production offline update behavior remain unverified. No claim that every button or every prototype works is justified by the checks above.

## Critical Issues

“Critical” here means a release-blocking functional issue; security severity is ranked separately below.

### C1 — Newer pending edits can be deleted by an older upload [High, reproduced]

- **File/location:** [data.ts:221](/Users/dailoclaw/.openclaw/workspace/projects/ev/src/lib/data.ts:221), [cache.ts:86](/Users/dailoclaw/.openclaw/workspace/projects/ev/src/lib/cache.ts:86).
- **Problem:** `flushOutbox` reads an operation, uploads it, then deletes by entity key alone. A second edit replaces that key while the first upload is in flight. The first acknowledgement deletes the second edit.
- **Impact:** A cost edit, delete, photo change, or settings update can disappear. A subsequent remote snapshot restores the older server value. Another open tab can trigger the same race.
- **Reproduction:** Queue revision A, read it as in flight, queue revision B under the same key, then acknowledge A. Outbox is empty instead of retaining B.
- **Fix:** Give every operation a unique revision token and atomically compare that token before deleting. Keep B pending, then flush again. Timestamp equality is insufficient because operations can share a millisecond. Coordinate uploads across tabs or explicitly support a single active writer.

### C2 — Failed durable writes are reported as completed mutations [High, reproduced]

- **File/location:** [data.ts:195](/Users/dailoclaw/.openclaw/workspace/projects/ev/src/lib/data.ts:195), mutation callers at 465–495; [EditSessionSheet.tsx:35](/Users/dailoclaw/.openclaw/workspace/projects/ev/src/components/EditSessionSheet.tsx:35), [Statement.tsx:87](/Users/dailoclaw/.openclaw/workspace/projects/ev/src/pages/Statement.tsx:87).
- **Problem:** State changes before IndexedDB completes. `persistAndSync` catches persistence errors without rethrowing or rolling back. Edit resolves, plays success feedback, and closes; delete returns the removed row. The Statement catch comment claims rollback that does not exist.
- **Impact:** A quota error, blocked IndexedDB, or transaction abort leaves a visible but undurable edit. Reload loses it. “Retry sync” cannot recover an operation that was never queued.
- **Fix:** Await durable mutation results. Reject on persistence failure; restore the affected entity without undoing concurrent newer changes, or publish state only after atomic persistence. Keep the form open and display an error. Treat local durability and cloud synchronization as separate outcomes.

### C3 — UI allows invalid settings that block the entire queue [High, traced]

- **File/location:** [Vehicle.tsx:376](/Users/dailoclaw/.openclaw/workspace/projects/ev/src/pages/Vehicle.tsx:376), Classic stepper at 563; [data.ts:557](/Users/dailoclaw/.openclaw/workspace/projects/ev/src/lib/data.ts:557); database limits in [006_constraints.sql:46](/Users/dailoclaw/.openclaw/workspace/projects/ev/supabase/migrations/006_constraints.sql:46).
- **Problem:** Efficiency can decrease below 1 to 0, and all increment controls lack upper limits. `updateAppSettings` performs no domain validation. Database rejects efficiency outside 1–100, petrol price above 20, and petrol use above 100. `flushOutbox` aborts at the first failure.
- **Impact:** Invalid assumptions appear saved locally, distort running-cost estimates, and prevent subsequent valid ledger operations from syncing until settings are corrected. A rejected provider/session/photo can likewise block the queue.
- **Fix:** Share limits across UI, mutation boundary, backup parser, and database tests. Disable controls at bounds. Distinguish permanent validation failures from transient failures and offer a visible correction/discard path; preserve dependency ordering when continuing independent operations.

### C4 — Calendar validation accepts impossible dates [High, reproduced]

- **File/location:** [validation.ts:19](/Users/dailoclaw/.openclaw/workspace/projects/ev/src/lib/validation.ts:19), backup parser callers.
- **Problem:** `Date.parse('2026-02-30T00:00:00Z')` succeeds by normalizing to 2 March. This is accepted as a valid session/backup date, but PostgreSQL rejects the date literal.
- **Impact:** An imported invalid date poisons the outbox; displays can mix February grouping with a March formatted date. Date parsing can differ between browser engines. [MDN Date.parse](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse) documents out-of-bounds behavior.
- **Fix:** Require an exact calendar round trip, not merely a non-NaN timestamp. Calculate the future-date bound using a consistent local-date policy; the current code computes a local tomorrow then formats it in UTC, whereas `todayIso()` uses local calendar components.

### C5 — Valid provider names can crash an entire route [High, reproduced]

- **File/location:** [Accounts.tsx:78](/Users/dailoclaw/.openclaw/workspace/projects/ev/src/pages/Accounts.tsx:78), [AppRoutes.tsx:20](/Users/dailoclaw/.openclaw/workspace/projects/ev/src/AppRoutes.tsx:20).
- **Problem:** React Router has already decoded `useParams().name`. Calling `decodeURIComponent` again throws for `50% Charger` and changes names containing literal encoded sequences such as `%20`.
- **Impact:** Opening that account throws `URIError`; there is no application error boundary to provide a recovery screen.
- **Fix:** Use the router parameter directly. Prefer stable provider UUIDs in future route links, preserving existing name URLs as redirects. Add an error boundary for render/lazy-import failures.

### C6 — Sign-out does not invalidate all asynchronous data work [High, traced]

- **File/location:** [data.ts:419](/Users/dailoclaw/.openclaw/workspace/projects/ev/src/lib/data.ts:419), stop at 442, persistence at 195, flushing at 221.
- **Problem:** `initializeData` has no owner/generation guard after awaiting the cache and outbox. Sign-out can clear state, then the old initialization applies cached data and subscribes again. `persistAndSync` also updates global state after awaits without checking the captured owner. Flush checks owner only after the entire batch, not before each upload.
- **Impact:** Late callbacks can repopulate signed-out memory or corrupt a subsequent session’s status; in-flight writes can continue after sign-out. RLS remains the server barrier, so this is not proven cross-account server access.
- **Fix:** Capture an owner/session epoch at every operation boundary. Verify it after each await and before side effects. Advance it on stop/reinitialize, clear reload timers, and cancel requests where supported. Do not let a prior epoch publish snapshots or subscribe channels.

## Major Issues

| ID / evidence | File and location | Problem and impact | Recommended fix |
|---|---|---|---|
| M1 / traced | `AddSheet.tsx:56–78`; `Settings.tsx:299` | Add has no error state or try/catch. Duplicate names, oversized names/notes/amounts, blank dates, or allowance >500 throw out of an event handler. Creating a provider happens before validating the session, leaving a provider behind when charge validation fails. Settings “+” throws above allowance 500. | Use form submission with complete validation and caught errors; atomically persist new provider + charge. Disable repeated submissions until persistence completes. |
| M2 / reproduced | `Vehicle.tsx:165`, distance branch around 268 | Minimal photo input exists only in overview. Distance “Add/change photo” clicks a null ref. Minimal also lacks Classic’s remove-photo control. | Mount one photo input outside conditional views; expose remove when a photo exists. |
| M3 / reproduced/traced | `backup.ts:60–66,91`; `data.ts:631–651` | V1 accepts negative/out-of-range budgets; duplicate normalized provider names pass parsing and delta computation. Restore then creates one provider before throwing on the duplicate, producing a partial restore. | Normalize and preflight the entire backup, reject duplicate identities, apply settings validator to all versions, compute the complete merge before writing. |
| M4 / traced | `data.ts:599–614,635–648`; `Settings.tsx:98` | Restore drops new providers’ archive/order metadata. Existing provider allowances/colors are retained although completion copy says settings restored. Missing/null backup photo retains current photo. `buildBackup` catches a photo download failure and silently emits null. `exportedAt` is not validated in v2. | Define merge semantics explicitly in preview. Preserve intended metadata; distinguish omitted photo, intentional removal, and failed read. Warn or fail incomplete backups and validate timestamp. Disable confirmation while restoring. |
| M5 / traced | `data.ts:221`; `cache.ts:82` | Operations use timestamps rather than dependencies. A newly queued provider can be edited after its new session is queued, moving provider upsert later than session upload; foreign key rejection stops sync. Photo/settings sequencing uses ±1 ms and can be disrupted by coalescing. | Schedule provider dependencies before sessions and photo dependencies before settings references, or use grouped mutations. Handle permanent failures explicitly. |
| M6 / traced | `data.ts:86–92`; `Settings.tsx:53` | Provider finalization always puts allowance providers first, ahead of stored `sortOrder`. Moving a paid provider above a free provider appears ineffective despite Settings promising picker order. | Make explicit order authoritative or constrain reorder UI and explain fixed grouping. |
| M7 / reproduced | `costConcentration.ts:30–46` | A valid 7 kWh/$5 session with allowance 7 becomes a 7 kWh, $0 block; $5 disappears because billed kWh is zero. Page can claim “No cost curve yet” despite positive energy cost. | Preserve cost for such rows (document attribution), or explicitly classify it as an excluded non-energy charge and report the excluded amount. Never silently lose spend. |
| M8 / traced | `savings.ts:126`; `repository.ts:44–45`; `data.ts:498` | Same-day allocation depends on input order; server fetch orders ties by random UUID. Local insert order can change after sync, moving free kWh between receipts. Undo creates a new UUID, reorders the row, and an upsert concurrent with another tab’s delete can leave duplicates. | Persist an explicit order/creation timestamp and use it consistently. Undo restores the original identity; combine with revision-aware acknowledgement. |
| M9 / traced | `yearOnYear.ts:65–75`; `Analytics.tsx:83–104,937` | “Previous year” selects the previous year present even when years are nonconsecutive. Matching months still compare current partial month against last year’s complete month. Minimal compares year-to-date to a full previous year. The claim that partial years never skew results is too strong. | Compare consecutive calendar years and completed matching months, or matching day cutoffs; disclose raw comparisons separately. |
| M10 / traced | `Home.tsx:145`; `Savings.tsx:25,311`; `derive.ts:46–75` | Engine supports many allowance providers but today's allowance/explanations select only the first. Aggregate free value may be labeled as that one provider. Six-month averages use last six *recorded* months, omitting zero-use months. | Show provider-scoped figures or all allowances; fill calendar gaps for time-window averages; make explanation match aggregation. |
| M11 / reproduced/traced | `data.ts:566–568`; `theme.ts:8`; `style.ts:12`; `density.ts:10`; migration at `data.ts:247` | Unguarded localStorage throws during settings updates before emit/durability. App startup appearance reads and migration also throw. Malformed legacy JSON shapes can cause `.map`/iteration/type errors. | Centralize safe storage reads/writes with runtime shape validation; local mirrors must not prevent authoritative persistence. Separate migration failure from ordinary sync and keep original legacy data until validated. |
| M12 / traced | `Settings.tsx:81–88`; `Vehicle.tsx:35–56`; `backup.ts:48` | Import checks size only after `file.text()` allocates it; errors are uncaught. Image upload has no pre-decode byte/pixel bound and scales width only: a narrow, extremely tall image can allocate a huge canvas. | Reject oversized files before reading; catch FileReader/file.text errors; bound both decoded dimensions, scale by max edge/pixel count, and catch canvas encoding failures. |
| M13 / traced | `cache.ts:30–42` | A failed open is permanently memoized. Retry keeps receiving the same rejected promise; no `onblocked` or `onversionchange` handling supports future schema upgrades. | Reset singleton on open rejection; close/reset on version changes; surface blocked upgrades and provide bounded retry. |
| M14 / traced | `data.ts:349–367`; `repository.ts:60–81` | Each sync fetches the complete snapshot twice and downloads photo twice, even after migration is marked done. Realtime from own writes/focus can request additional runs. Paginated snapshots are not transactional across tables/pages. | Fetch once unless migration actually queued writes; avoid re-downloading unchanged photos; use snapshot/version policy for concurrent edits and stable pagination. |

There is no general search feature or CSV import in the active application; absence is not reported as a broken feature. JSON merge restore is the implemented import path. Compare year “buttons” have no handlers: they are static selected-period displays and should be spans, or become real selectors if period selection is intended.

## Minor Issues

| Issue | Location | Safe action |
|---|---|---|
| Large mixed presentation modules | `Analytics.tsx` 1,410 lines, `Vehicle.tsx` 646, `Settings.tsx` 567; `App.css` 4,854 | Extract views and shared domain selectors gradually after persistence fixes; preserve route behavior. |
| Perceived successful export regardless of actual download completion | `Settings.tsx:65–76` | Label “download requested”; browsers cannot reliably confirm a completed download. |
| Timer callbacks outlive pages | `Statement.tsx:85–95`, `Settings.tsx:68`, `AchievementCelebration.tsx:109–121` | Clean up timers on unmount. Current impact is stale callbacks/minor retention, not demonstrated growing listener leakage. |
| Inaccurate narrative strength | `narrate.ts:93–95`; `CostAnatomy.tsx:94–97` | “Almost all” currently starts at 40% of cost; “nearly as much” applies to any smaller fee share. Use measured thresholds/text. |
| Fee count is number of fee-bearing months | `CostAnatomy.tsx:107` | Count fee rows if labeling “charges”; otherwise label “months”. |
| Fee-only analytics shows zero blended rate | `costAnatomy.ts:124–126` | Render unavailable rate when denominator is zero, retaining total fee cost. |
| Zero budget causes NaN width when spend is zero | `ui.tsx:163` | Define cap=0 behavior. Backup/DB permit zero while budget slider is 20–150; align/display bounds explicitly. |
| Provider called “All” collides with filter sentinel | `Analytics.tsx:961–965`; `AnalyticsChart.tsx:17–20` | Use null/ID for all-provider scope. Provider validation currently permits “All”. |
| Changing view state is not URL-addressable | Minimal Vehicle/Savings/Stats | Optional incremental improvement: query/hash state with browser-back behavior; no rewrite needed. |
| Historical architecture document is stale | `architecture/ev-architecture.html:449,465,470` | Update diagrams describing seed JSON/local-only backend and localStorage mutation persistence to current auth/IndexedDB architecture. |
| Rendered HTML content-model problems | `Explainable.tsx:67` used with `CostAnatomy.tsx:59` div; `Analytics.tsx:654` divs in ledger button | Use phrasing markup/spans within buttons, or restructure control semantics. Browser repair is not proof of HTML conformance. |

## Dead Code

Confirmed removable from the current application, subject to retaining intentional external/documentation APIs:

- [ui.tsx:268](/Users/dailoclaw/.openclaw/workspace/projects/ev/src/components/ui.tsx:268): `TickSvg` has no callers. Remove together with `.ticksvg` selectors/keyframes only after checking selector references.
- [validation.ts:65](/Users/dailoclaw/.openclaw/workspace/projects/ev/src/lib/validation.ts:65): `isUuid` and its `UUID` constant have no callers. Either remove or apply them where UUID validation is needed; backup legacy IDs need an intentional compatibility policy.
- `src/assets/hero.png` (~44.9 kB): no current source/design references found; not imported into the application bundle.
- `public/car.jpg`, `car1.jpg`…`car5.jpg` (~304.0 kB total): no current source/design references found. Vite still copies public assets into deployment, although PWA glob excludes them. Confirm they are not intentionally used by external links before deletion.

Do **not** remove `public/favicon.svg`: referenced by PWA `includeAssets`. Do not remove `icon.jpg`, `theme-init.js`, attribution/license files, cache test reset helpers, migration history, or design prototypes merely because they are absent from route code. `clearOfflineCache` is used by tests and is a useful recovery primitive.

A complete dynamic CSS-selector reachability proof was not established. There are template-generated classes and imported library internals; blindly deleting every class absent from literal JSX would be unsafe. No lint-detected unused local variables were found. The inaccurate rollback comment in Statement should be corrected; explanatory comments around calculation rules are useful and should remain.

## Duplicate Code

| Duplication | Consolidation |
|---|---|
| Classic/Minimal vehicle calculations and photo handlers | Shared vehicle model and photo hook; keep presentation components distinct |
| Classic/Minimal Home month selection and comparison | Shared current-month selector with explicit calendar comparison policy |
| Classic/Minimal Savings allowance selection | Shared provider-scoped allowance model; fix multiple-provider semantics once |
| Sheet backdrops/dialog declarations | Shared accessible modal shell with focus, Escape, close button, scroll behavior |
| Provider/month/year aggregation in Analytics and AnalyticsChart | Pure reusable selectors keyed by provider ID/metric/calendar period |
| Reduced-motion snapshots repeated across animations | Existing reactive `useReducedMotion` hook |
| Theme/style/density local mirrors in startup, App, AuthGate, data store | One safe storage adapter; one authority for settings |
| `monthLabel` and month/date formatting | Shared date-format utility, consistent locale/calendar semantics |

Consolidate calculation and lifecycle behavior; do not force Classic and Minimal into a heavily conditional single component.

## Performance Improvements

Ranked by expected impact; no CPU profiling was performed, so timings below are qualitative.

1. **High: batch restore mutations.** `restoreMerge` invokes `addSession` repeatedly; each copies growing arrays, emits globally, and writes the entire growing snapshot. At the accepted 100,000-row limit this approaches quadratic copy/persistence work and can freeze the UI or exhaust storage. Build the merged state and operation list once, then commit once; page progress/cancellation for large restores.
2. **High for large histories: separate derivation from sync status.** `useEv` recomputes sorting/enrichment/aggregates for status, photo, budget and unrelated settings changes, in every consumer. Memoize the domain model on sessions/providers, and compose small status/settings fields separately. `RecordsSection` and celebration should share expensive records derivation where useful.
3. **Medium: remove redundant full refresh/photo reads.** A typical successful sync does two complete reads plus photo downloads. Realtime self-echo/focus adds more. Avoid the second read when migration did nothing, cache photos by change/version, debounce redundant triggers without delaying durable saves.
4. **Medium: index provider and month lookups.** Many rendered rows call `.find` over providers; `daySpark` scans all sessions for each displayed month. Build provider maps and month/day buckets once per domain revision.
5. **Medium: paginate long Statement views.** Every session in a selected month is rendered. Add incremental rendering/virtualization only after measuring realistic large-month data and preserving keyboard behavior.
6. **Low/Medium: contain animations.** Numerous CountUpNumber components perform React updates on animation frames. Animate from previous displayed value and avoid restarting on unrelated status events. Prefer imperatively painted visuals for dense charts where measurements justify it.
7. **Low: make donut segment accumulation linear.** `SplitView` repeatedly sums/copies accumulated segments. Use a running offset.
8. **Low: move changelog to on-demand import.** Settings eagerly imports a ~15.7 kB changelog chunk; lazy-load the sheet if reducing first Settings load matters.
9. **Low: remove unused public vehicle images.** Reduces deployment size by ~304 kB; they are already excluded from precache, so no claimed first-page saving.

Existing route lazy loading and bounded coalescing by entity are worth retaining, but “bounded” means one pending record per entity; total outbox count/bytes still grows with new entities.

## Security Findings

| Rank | Finding | Exposure and fix |
|---|---|---|
| Critical | **No confirmed critical security vulnerability** | Functional data-loss issues are separately release-blocking. |
| High | Vulnerable `brace-expansion` 1.1.18, 2.1.4, 5.0.9 transitively installed | npm reports recursion/CPU denial of service. Primarily ESLint/TypeScript/Workbox tooling in this application; no proven public ledger-input path to these libraries. Refresh affected transitive dependencies and rerun audit/build/CI. [Maintainer advisory](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-qhr7-859c-m2p7). |
| High | Vulnerable `source-map-js` 1.2.1 transitively installed | npm reports event-loop DoS through indexed source maps, patched at 1.2.2. Present through PostCSS/Tailwind/coverage tooling; no demonstrated runtime browser exploit. Update to fixed compatible release and verify bundle. [Advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q). |
| Medium | Incomplete CSV formula/control-character handling, `exports.ts:4–7` | Only immediate `= + - @` prefix is neutralized and CR is not quoted. Backup-imported notes can contain leading tabs/CR or delimiters. Spreadsheet interpretation depends on consumer. Quote CR as well as LF, neutralize control/whitespace-prefixed dangerous values, test actual Excel/LibreOffice import. [OWASP CSV injection](https://owasp.org/www-community/attacks/CSV_Injection). |
| Medium | Unbounded pre-parse file/image allocation, M12 | Local malicious file can hang the browser or fill cache. Set pre-read limits and validate decoded image dimensions. This is availability risk, not demonstrated code execution. |
| Low | Cache survives sign-out; `stopDataSync` clears memory only | IndexedDB ledger/outbox/photo and auth-local persistence are readable by code/user with access to that browser profile. Cache owner check helps session isolation but is not encryption. Explain device retention and offer explicit clear-device-data handling after pending-write warning. Do not silently destroy offline work on ordinary sign-out. |
| Low | Broad `connect-src https: wss:` in `vercel.json` | Allows connections to any HTTPS/WSS origin. Narrow to configured Supabase/project origins if deployment setup permits. Existing CSP is useful but cannot compensate for future DOM injection. |
| Low / future risk | `innerHTML` in architecture/design documents | Examples such as `architecture/ev-architecture.html:611,654` interpolate fixed local constants. No untrusted production input path was found. Use `textContent`/DOM construction if these documents start consuming remote/user data. |

No `eval`, `new Function`, or `dangerouslySetInnerHTML` was found in application source. React escapes ordinary session/provider text. Private bucket MIME limits, owner-folder restrictions, security-invoker view, fixed SQL API usage, and removal of anonymous table grants are positive code-level findings. Migration 002 historically grants open access but migration 005 removes it; do not call the earlier file a current exploit without checking deployment state.

No session tokens/passwords are included in application backups. The browser publishable/anon key is not a secret. Auth sessions and caches are accessible to same-origin scripts; avoid adding unsafe DOM sinks. Real anonymous/non-owner/owner RLS tests are still required against a disposable migrated database.

## Accessibility Findings

| Priority | Violation / location | Fix and verification |
|---|---|---|
| High | Add/Edit/Receipt/Explain/What's New sheets declare `aria-modal` without focus trapping, initial focus, focus restoration, Escape handling, or a normal close control. Receipt failure reproduced. | Use native `dialog.showModal()` or a tested accessible modal shell. Make close available, keep Tab within modal, restore invoker focus, prevent background interaction. Records/celebration handle Escape but still lack complete modal focus behavior. [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). |
| High | Labels in Add/Edit are separate bare `<label>` elements with no `htmlFor`/wrapped input. Budget range at Settings:387 has no accessible name. Stepper +/− labels lack context. | Stable IDs/associated labels, `aria-describedby` error/unit text, names such as “Decrease vehicle efficiency”. Verify role/name queries and screen reader announcements. |
| High | `index.html:6` sets `user-scalable=no` | Remove zoom restriction; test 200% zoom and mobile text enlargement. |
| Medium | Small `.cap`/footer/unit text uses `--fnt` with insufficient contrast | Calculated light `#8496a3` on white **3.06:1**, on canvas **2.80:1**; dark `#5f6a72` on surf **3.47:1**. Normal text needs 4.5:1. Retune text tokens and verify actual backgrounds across styles. [W3C contrast guidance](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum). |
| Medium | Trends clickable SVG circles (`Analytics.tsx:1050`) have no keyboard equivalent | Add focusable named controls/keyboard selection or accompanying data table. Bars based on `data-v`/title need programmatic value alternatives. |
| Medium | `.sheet .fld input` sets `outline:none` (`App.css:1757`) | Ensure an equally visible `:focus-visible`/`:focus-within` indicator. Test keyboard appearance on every form. |
| Medium | Reduced motion read once in CountUpNumber/Ring/Donut/Trends/useUnitRoll | Use reactive hook; CSS stopping animation does not stop their JS frame loops when preference changes after mounting. Existing SloshGauge test verifies only its reactive path. |
| Medium | Achievement auto-dismiss after 3.8 seconds | Provide stable notification/history access and allow users to pause/read; modal dismissal must not strand focus. |
| Low | Account not-found icon-only Back lacks `aria-label`; provider/color selections omit state announcements in some controls | Add accessible names and `aria-pressed` for toggle chips; use real semantic tables for data where practical. |

Contrast calculations are deterministic token checks, not an exhaustive pixel/compositing audit. No full axe or screen-reader certification was performed. Semantic `main`, route headings, navigation labels, Auth form labels, sync status live region, and meter attributes are existing strengths.

## Browser Compatibility Review — Chrome and Edge

Current Chromium smoke tests pass. Chrome and Edge share Chromium but product-specific settings/extensions/storage policies still require a Microsoft Edge run. No Edge project is configured. WebKit smoke coverage is extra evidence, not a substitute for Edge.

- `crypto.randomUUID`, IndexedDB, ResizeObserver, `inert`, Pointer Events, and `color-mix` establish a modern-browser baseline. Declare supported versions and test managed browsers with storage disabled; do not claim support for all historical versions.
- Restricted/blocked localStorage and failed IndexedDB already cause M11/M13. These are real environment compatibility failures, not just private-browsing assumptions.
- Impossible-date normalization is not reliable validation across engines; C4 resolves this.
- `LiquidGlass`/backdrop/SVG filtering needs visual comparison on Edge and low-powered devices. Keep an opaque readable fallback if unsupported/disabled.
- Existing browser tests use `npm run dev`; service worker generation, deployment CSP, chunk-update failure, direct route reload, offline first install, and offline cached navigation are untested.
- PWA NetworkFirst navigation with null navigation fallback requires testing a route never visited online. Per-URL navigation caching may not cover that URL offline despite a precached index; treat as a risk until reproduced.
- Auto-updating a service worker while an old page retains lazy chunk URLs can fail dynamic imports after caches are cleaned. Add a recovery boundary and test an upgrade with an open tab.

## Architecture Review

| Dimension | Score | Assessment |
|---|---:|---|
| Modularity | 7/10 | Pure engines/repository/cache split is good; mutation and lifecycle coordination remain bundled in `data.ts`. |
| Maintainability | 5/10 | Duplicated presentation-domain calculations, large Analytics/CSS files, inconsistent error contracts. |
| Scalability | 5/10 | Adequate for a small personal ledger; full-snapshot persistence, repeated aggregates, restore copying constrain accepted data sizes. |
| Readability | 7/10 | Types and descriptive functions are generally clear; some dense JSX and inline formulas obscure contracts. |
| Overall | **6/10** | Improve boundaries and tests without changing the product architecture. |

`data.ts` is effectively a global mutable store and sync coordinator, not an inherently wrong choice for a single-owner app. Its missing invariants are the problem: who owns an async operation, which revision is being acknowledged, when a mutation becomes durable, and which writes depend on others. Make those invariants explicit before extracting more files.

There is no justification for introducing a new state library or rewriting the application. Add a durable mutation boundary, an owner-scoped sync coordinator, shared validated domain selectors, and an accessible modal primitive. Keep the facade and route contracts stable.

## Refactoring Recommendations

1. Create a typed mutation result contract: validation → durable atomic snapshot/outbox commit → visible success → eventual sync status. Do not swallow storage failure.
2. Add operation revisions, owner/session epoch guards, dependency-aware scheduling, and a permanent-error recovery path.
3. Unify settings/session/provider/backup validation and numeric normalization with database precision. Cost uses 2 decimals, energy 3, allowance 2; unexpected extra precision currently changes after remote read and can defeat exact backup signatures.
4. Implement one batched restore planner with explicit metadata/photo semantics, complete preflight, and durable commit.
5. Fix the small route/photo/order problems before broad presentation cleanup.
6. Introduce the modal shell and accessible field/stepper patterns once, then adopt them incrementally.
7. Extract shared vehicle/calendar/provider models from page components; memoize on domain inputs rather than sync status.
8. Remove only confirmed unused symbols/assets and update stale documentation.

## Suggested Code Changes

Illustrative patches below are **recommendations, not applied fixes**. They require tests and call-site updates described in the plan.

### 1. Acknowledge the uploaded revision, not the entity key (C1)

Original:

```ts
await applyOutboxOperation(operation, currentOwnerId)
await removeOutboxOperation(operation.id)
```

Improved contract:

```ts
// Add revision: crypto.randomUUID() when constructing every operation.
await applyOutboxOperation(operation, currentOwnerId)
await acknowledgeOutboxOperation(operation.id, operation.revision)

export async function acknowledgeOutboxOperation(id: string, revision: string) {
  const db = await openDb()
  const tx = db.transaction(OUTBOX, 'readwrite')
  const done = transactionDone(tx)
  const store = tx.objectStore(OUTBOX)
  const request = store.get(id)
  request.onsuccess = () => {
    const current = request.result as OutboxOperation | undefined
    if (current?.revision === revision) store.delete(id)
  }
  await done
}
```

Comparison and deletion must occur in the same transaction. Upgrade existing queued operations with revision tokens; schedule another pass if a replacement remains.

### 2. Make storage failure fail the save (C2)

Original:

```ts
catch (error) {
  state = { ...state, syncStatus: 'error', lastSyncError: /* message */ }
  emit()
}
```

Improved minimum error contract:

```ts
catch (error) {
  state = { ...state, syncStatus: 'error', lastSyncError: toMessage(error) }
  emit()
  throw error
}
```

All void fire-and-forget mutation callers must then become awaited/caught. This snippet alone is insufficient: add revision-aware rollback or publish-after-commit behavior. Keep network sync asynchronous after durable local commit so offline saves remain valid.

### 3. Validate exact calendar dates (C4)

Original:

```ts
if (!ISO_DATE.test(session.date) || Number.isNaN(Date.parse(`${session.date}T00:00:00Z`)))
  return 'Date must be valid.'
```

Improved:

```ts
function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
if (!isCalendarDate(session.date)) return 'Date must be valid.'
```

Use a local-date helper for future bounds and align accepted policy with database constraints. Test leap years and Adelaide midnight/DST boundaries.

### 4. Remove double URL decoding (C5)

Original:

```ts
const { name = '' } = useParams()
const decoded = decodeURIComponent(name)
```

Improved:

```ts
const { name = '' } = useParams()
const summary = ev.byProvider.find(provider => provider.name === name)
const provider = ev.providers.find(provider => provider.name === name)
const sessions = ev.sessionsDesc.filter(session => session.type === name).slice(0, 12)
```

Names containing percent signs/encoded-looking text remain intact.

### 5. Guard async initialization (C6)

Original:

```ts
const cached = await loadCachedSnapshot().catch(() => null)
if (cached?.ownerId === currentOwnerId) applyCachedSnapshot(cached)
```

Improved pattern:

```ts
const epoch = ++sessionEpoch
ownerId = currentOwnerId
const active = () => sessionEpoch === epoch && ownerId === currentOwnerId
const cached = await loadCachedSnapshot().catch(() => null)
if (!active()) return
if (cached?.ownerId === currentOwnerId) applyCachedSnapshot(cached)
const pending = await listOutbox(currentOwnerId)
if (!active()) return
// Publish and subscribe only for this epoch.
```

Increment `sessionEpoch` and clear reload timers in `stopDataSync`. Apply the same guard to persistence, migration, flush and remote refresh; do not increment it during ordinary refreshes.

### 6. Validate settings before any state/local mirror mutation (C3/M11)

Original:

```ts
state = { ...state, settings, budgetCap: settings.budgetCap }
localStorage.setItem(LS_THEME, settings.theme)
```

Improved pattern:

```ts
const error = validateAppSettings(settings)
if (error) throw new Error(error)
await commitMutation({ nextSettings: settings, operations: [settingsOperation] })
try {
  localStorage.setItem(LS_THEME, settings.theme)
  localStorage.setItem(LS_STYLE, settings.style)
  localStorage.setItem(LS_DENSITY, settings.density)
} catch {
  // Optional appearance mirrors do not determine ledger durability.
}
```

`commitMutation` is a proposed boundary, not an existing API. `validateAppSettings` must enforce all schema limits and enums. UI controls should use the same bounds and await/catch the mutation.

### 7. Catch form errors and avoid partial provider creation (M1)

Original:

```ts
const p = addProvider(newName, newFree, newColor)
addSession({ date, type: p.name, amount: kwh, cost, notes })
setSaved(true)
```

Improved pattern:

```ts
setSaving(true)
setError(null)
try {
  await createCharge({ newProvider: showNew ? providerInput : null, session: sessionInput })
  setSaved(true)
} catch (error) {
  setError(toMessage(error))
} finally {
  setSaving(false)
}
```

`createCharge` validates both objects before committing them together. Use `<form onSubmit>` and disable its submit while saving. Success feedback follows durability.

### 8. Keep the photo input mounted across Minimal views (M2)

Original: file input is inside the `view === 'overview'` branch.

Improved:

```tsx
<main className="app-shell cv cv-vehicle">
  <input ref={photoInputRef} type="file" accept="image/*"
    hidden onChange={onPhotoChosen} />
  {view === 'overview' ? <Overview /> : view === 'distance' ? <Distance /> : <OtherView />}
</main>
```

The input remains available to every photo trigger. This illustrates placement, not a requirement to extract all views immediately.

### 9. Deduplicate normalized provider identities and validate legacy settings (M3)

Original:

```ts
const newProviders = backup.providers.filter(p => !existingProviderNames.has(p.name.toLowerCase()))
settings: { ...DEFAULT_SETTINGS, budgetCap: legacy.budgetCap }
```

Improved pattern:

```ts
const normalizeName = (name: string) => name.trim().toLowerCase()
const seen = new Set<string>()
for (const provider of backup.providers) {
  const key = normalizeName(provider.name)
  if (seen.has(key)) return null // Reject ambiguous backups before any mutation.
  seen.add(key)
}
const settings = { ...DEFAULT_SETTINGS, budgetCap: legacy.budgetCap }
if (validateAppSettings(settings)) return null
```

Use the normalization consistently for provider/session matching and signatures. Apply byte/type/photo validation to both backup versions.

### 10. Preserve explicit provider ordering (M6)

Original:

```ts
Number(b.freeKwhPerDay > 0) - Number(a.freeKwhPerDay > 0) ||
(a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
```

Improved:

```ts
(a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
a.name.localeCompare(b.name)
```

If free-first is a product requirement, adjust the reorder control instead; the promise and behavior must agree.

### 11. Reject oversized import files before reading (M12)

Original:

```ts
const text = await file.text()
const backup = parseBackup(text)
```

Improved:

```ts
try {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup file is too large.')
  const backup = parseBackup(await file.text())
  if (!backup) throw new Error('Invalid EV Command backup.')
  setPending({ backup, ...previewRestore(backup) })
} catch (error) {
  setRestoreError(toMessage(error))
}
```

Use a documented byte limit and retain parser limits. For photos, enforce a byte bound and scale by both width and height before canvas encoding.

### 12. Harden CSV serialization (security Medium)

Original:

```ts
const text = typeof value === 'string' && /^[=+\-@]/.test(raw) ? `'${raw}` : raw
return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
```

Improved baseline:

```ts
const dangerous = typeof value === 'string' &&
  (/^[\t\r\n]/.test(raw) || /^[\s\uFEFF]*[=+\-@]/.test(raw))
const text = dangerous ? `'${raw}` : raw
return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
```

This closes specific serializer gaps; spreadsheet-specific interpretation still requires consumer tests. Do not claim universal formula safety from a regex.

### 13. Replace bare labels and add modal semantics (accessibility)

Original:

```tsx
<label>Energy</label>
<input type="number" value={kwhStr} />
<div role="dialog" aria-modal="true">...</div>
```

Improved pattern:

```tsx
<label htmlFor="charge-energy">Energy</label>
<input id="charge-energy" type="number" aria-describedby="charge-energy-unit" />
<span id="charge-energy-unit">kWh</span>
<dialog ref={dialogRef} aria-labelledby="charge-title" onCancel={onClose}>
  <h2 id="charge-title">New charge</h2>
  <button type="button" onClick={onClose} aria-label="Close">×</button>
</dialog>
```

A shared wrapper must call `showModal()` and handle React lifecycle, backdrop dismissal, focus restoration and stacked dialogs. Merely changing the element without opening it is insufficient.

## Verdict Plan

Apply the following sequence. Each step has a concrete acceptance gate; do not start broad cleanup before the data-integrity gates pass.

### Step 1 — Protect pending edits (C1, C6, M5)

**Latest implementation update (9 October 2026):** M5 explicit provider/session and photo/settings ordering is implemented and verified locally in v4.3.4. See [dependency fix notes](DEPENDENCY-ORDERING-FIX.md). C1, C6 and M5 core fixes are now implemented; cross-tab conflict management remains open. Earlier updates below record their original delivery scope.

**Further implementation update (9 October 2026):** C6 session generation and lifecycle guards are implemented and verified locally in v4.3.3. See [session fix notes](SESSION-LIFECYCLE-FIX.md). Dependency ordering and cross-tab conflict handling remain open. The older update below records the prior v4.3.2 scope.

**Implementation update (9 October 2026):** C1 revision-aware acknowledgement and legacy queue compatibility are implemented and verified locally in v4.3.2. See [fix notes](SYNC-ACKNOWLEDGEMENT-FIX.md). Session epochs, dependency ordering and the remaining acceptance scenarios are still open.

1. Add unique operation revision tokens with backward-compatible migration for already queued records.
2. Implement atomic compare-and-delete acknowledgements.
3. Introduce session epochs and guard every asynchronous publication/upload, including initialization and sign-out.
4. Schedule dependent provider/session/photo/settings writes explicitly; avoid timestamp tricks.
5. Add deterministic paused-network tests: upload A, queue B, resume A, verify B remains pending and ultimately appears on server. Repeat for update→delete, delete→undo, settings, photo, and two tabs.
6. Pause cache initialization, sign out, resume it; verify empty signed-out state and no old channel. Pause upload, change owner epoch, verify no later old-batch writes.
7. **Gate:** no latest-revision loss, no stale-session publication, no dependency-induced foreign key failure.

### Step 2 — Make saves durably truthful (C2, M11, M13)

**Implementation update (9 October 2026):** Publish-after-commit mutations, atomic paired saves/restores, recoverable storage errors and awaited UI save outcomes are implemented locally in v4.3.5. See [durable-save notes](DURABLE-SAVE-FIX.md). Shared input validation and cross-tab conflict handling remain open.

1. Choose publish-after-commit or revision-aware optimistic rollback and apply consistently.
2. Return promises/results from all mutations; update Add/Edit/Delete/Settings/Photo/Undo callers to handle failures.
3. Put optional localStorage mirroring behind safe access wrappers.
4. Recover IndexedDB open state on failure; support blocked/version-change notifications.
5. Force quota exceeded, transaction abort, denied localStorage and initial DB-open failure in tests.
6. Verify forms stay open with actionable errors, no success tone/snackbar on failed durability, no lost rows on reload, and retry can recover without misleading “queued safely”.
7. **Gate:** every reported successful local mutation survives reload; every failed local mutation is visible and recoverable.

### Step 3 — Stop invalid writes entering the queue (C3, C4, M1)

**Implementation update (9 October 2026):** Shared settings bounds/enums, exact calendar dates, SQL precision normalization and bounded form/stepper controls are implemented locally in v4.3.6. Invalid live saves and restores are rejected before commit; invalid legacy settings/dates preserve the migration source and report an error. See [input-validation notes](INPUT-VALIDATION-FIX.md). Permanent server failure classification and correction/retry/discard, existing invalid queued writes, and disposable Supabase rejection/timezone verification remain open; the full Step 3 gate is not yet complete.

**Recovery update (9 October 2026):** v4.3.7 adds durable rejection classification, independent-write progress, correction/retry controls and explicit all-pending discard with an atomic recovery archive. Settings updates now require a matching returned owner row before acknowledgement. See [sync-recovery notes](SYNC-RECOVERY-FIX.md). Disposable Supabase rejection/timezone verification remains outstanding, so the complete Step 3 gate is still open.

1. Implement shared settings limits/enums and exact calendar validation.
2. Validate owner existence before state mutation; normalize numeric precision to schema.
3. Bound steppers, add form errors/maxLength, validate provider + session together.
4. Distinguish transient server failure from permanent invalid/unauthorized/conflict failures; expose correction/retry/discard without silently deleting data.
5. Test zero, NaN, Infinity, min/max±step, duplicate/archived providers, notes length, blank date, leap/non-leap February and local/UTC midnight.
6. Test database rejection in a disposable Supabase project; fake backend currently does not enforce all constraints.
7. **Gate:** invalid user/import values cannot poison sync; valid later independent writes have a documented recovery path.

### Step 4 — Make backup/restore reliable and bounded (M3, M4, M12, performance #1)

1. Define and display merge semantics for matching providers, archive/order metadata, and absent/photo-null values.
2. Preflight byte size, runtime shape, duplicate identities, dates, metadata and allowed base64 JPEG/PNG/WebP content. Reject unsupported/invalid data URLs before queueing storage operations.
3. Create a complete merge plan with stable identities; apply all local state/outbox changes in one atomic transaction.
4. Disable repeated confirmation, report large-import progress, and surface incomplete photo backup errors.
5. Test v1/v2 compatibility, duplicate provider names, duplicate sessions, archived/order round trips, no-photo/photo deletion, corrupt base64, oversized/read-failure files, and retry after rejected remote writes.
6. Benchmark 1k/10k rows and the supported maximum; lower the advertised maximum if realistic devices cannot handle it.
7. **Gate:** no partial local restore on validation/cache failure, honest restored counts/metadata, no silent photo omission, acceptable memory/time.

**Implementation update (9 October 2026):** Shared bounded backup preflight, explicit v1/v2 settings/photo semantics, UUID/metadata-preserving merge plans, atomic retryable restores, complete photo exports and worker/offline file handling are implemented locally in v4.3.8. See [backup/restore notes](BACKUP-RESTORE-FIX.md). Desktop scale measurements cover large imports; the physical low-end-device performance gate, live storage/RLS and production service-worker acceptance checks remain open.

### Step 5 — Fix quick visible failures (C5, M2, M6, M8)

1. Remove account double decode and add recovery boundary; test `%`, `%20`, Unicode, slash-encoded names and renamed provider links.
2. Move Minimal photo input outside branches and expose remove; verify picker opens from overview/distance, uploaded image persists after reload, removal persists.
3. Make explicit provider order effective; verify a paid provider can move across a free provider and persists through sync.
4. Restore original UUID on Undo; use stable order for same-day allowance allocation.
5. **Gate:** these controls work in both styles, online/offline, after refresh.

**Implementation update (9 October 2026):** Special-name account routes and stable ID links, routed-page recovery, shared photo handling with the Minimal input mounted across views, authoritative charger order, original-identity Undo and creation-time/UUID allocation order are implemented locally in v4.3.9. See [visible functional fix notes](VISIBLE-FUNCTIONAL-FIX.md). Local browser checks use a fake backend; deployed schema/RLS/storage and cross-tab conflict acceptance remain open.

### Step 6 — Repair analytics semantics (M7, M9, M10)

1. Specify attribution for paid costs on fully allowance-covered rows; assert concentration total equals scoped energy cost or separately reports exclusions.
2. Use completed matched periods or matched day cutoffs for comparisons; consecutive calendar years only.
3. Represent zero-use months explicitly where “six months” is claimed.
4. Support multiple allowance providers in today's panels/derivations and remove hardcoded Jolt fallbacks when none exists.
5. Test fee-only, all-free, no history, multiple providers, missing years/months, ongoing month, zero reference rate, zero budget and changing allowances.
6. **Gate:** receipts/CSV/chart/explanations agree on the same totals and scope.

**Implementation update (9 October 2026):** Recorded-cost attribution with disclosed non-energy exclusions, completed matching consecutive-year comparisons, equal-day Home comparisons, calendar-filled six-month series and multiple-network allowance displays are implemented locally in v4.3.10. Zero-budget gauges and allowance/reference-rate explanations are corrected. See [analytics semantics notes](ANALYTICS-SEMANTICS-FIX.md). Historical allowance versions are not stored; current settings are explicitly applied across history. Production environment and cross-tab acceptance remain open.

### Step 7 — Close security and accessibility gaps

1. Refresh vulnerable dependency resolutions on a branch; avoid forced major upgrades. `npm audit fix` may help, but inspect its lockfile diff and compatibility instead of accepting it blindly.
2. Run `npm ci`, `npm audit --audit-level=high`, lint, typecheck, coverage, build and bundle budgets; confirm all nested versions are fixed.
3. Harden CSV and validate malicious prefix/control/delimiter fixtures in actual spreadsheet applications.
4. Roll out shared modal, associated field labels, named steppers, focus indicators and keyboard chart controls.
5. Remove zoom restriction, fix low-contrast tokens, use reactive reduced-motion behavior.
6. Test Tab/Shift+Tab, Escape, invoker focus restoration, screen reader names/errors, 200% zoom, both themes/styles, and nested celebration/sheet behavior.
7. **Gate:** security audit passes and modal/form workflows are independently usable by keyboard and assistive technology.

**Implementation update (9 October 2026):** Compatible vulnerable dependency patches, hardened CSV serialization, shared native dialogs, associated field labels, budget naming, keyboard trend controls, zoom enablement, contrast tokens and reactive motion preferences are implemented locally in v4.3.11. See [security/accessibility notes](SECURITY-ACCESSIBILITY-FIX.md). Actual Excel/LibreOffice import and save/reopen, independent screen-reader validation and physical zoom acceptance remain open; Computer Use permissions blocked Excel UI validation. The full Step 7 manual gate is not complete.

### Step 8 — Validate the production environment

1. Add a Microsoft Edge Playwright project and manual managed-Edge checks.
2. Serve the actual production build with deployed-equivalent headers; test CSP and lazy chunks.
3. Test installed PWA cold start/offline visited and unvisited routes, online recovery, open-tab upgrade and stale chunk failure.
4. In a disposable Supabase project apply every migration; assert anon and authenticated non-owner denial, owner read/write access, private photo isolation, constraints, Realtime, and settings zero-row writes. Repository should verify a settings update actually affected the expected owner row before acknowledging it.
5. Test photo-storage failure and paginated reads with >500 sessions plus concurrent edits.
6. **Gate:** no unexplained runtime exceptions, no pending-write loss, actual RLS/storage behavior matches code assumptions.

**Implementation update (9 October 2026):** v4.3.12 adds production-build CSP/lazy-route/PWA/queue/recovery checks, branded Edge test projects and CI installation, an offline navigation shell fallback, stricter settings-row acknowledgement and an idempotent settings Realtime publication migration. See [production validation notes](PRODUCTION-VALIDATION.md). Disposable database/RLS/storage/Realtime, installed/managed Edge and actual deployed upgrades remain open; Step 8's full gate is not complete.

### Step 9 — Reduce maintenance cost

1. Extract domain selectors and large view components incrementally; avoid changing visible functionality.
2. Separate calculation memoization from sync status; batch DOM/data work only where profiling shows benefit.
3. Remove confirmed dead symbols/assets, clean stale comments/architecture docs and static pseudo-buttons.
4. Re-run the established suite once per meaningful change; broaden checks only when new risks justify it.
5. **Gate:** same verified behavior with smaller, easier-to-review modules and measurable performance improvements.

**Implementation update (10 October 2026):** v4.3.13 shares ledger calculations across immutable session/provider inputs, narrows Home/records memoization to relevant data and calendar inputs, extracts Minimal Stats and Classic Trends, and removes confirmed unused record-close styles and stale comments. A synthetic 20,000-session benchmark measures calculation reuse; existing browser behavior is verified by the established suites. See [maintenance cleanup notes](MAINTENANCE-CLEANUP.md). Larger modules and unconfirmed assets are preserved; Step 7–8 external acceptance gates remain open.

**CI acceptance follow-up (10 October 2026):** Main v4.3.13 passes static verification and 135 development browser checks including branded Edge, but fails its production-browser CI step. v4.3.14 prepares a reconnect-test correction and diagnostic artifacts locally; the remote failure remains unresolved until logs or a successful rerun establish the result. See [CI follow-up](CI-FOLLOW-UP.md).

## Final Verdict

**Remediation status (10 October 2026):** The defect lists below preserve the original audit verdict. Subsequent step updates document the implemented fixes through v4.3.13. Local automated checks pass; production approval is still pending the Step 7–8 external acceptance gates, rather than every original code defect remaining unresolved.

**Must fix before approval:** revision-aware sync acknowledgement, truthful durable-save failure handling, settings/date validation, session-lifecycle guards, malformed/partial restore behavior, account-route crash, modal keyboard behavior, and high-severity dependency findings. The small photo-input/order fixes should be completed alongside those changes.

**Improve afterward:** analytics period/provider semantics, large-import performance, shared selectors, CSS/module size, confirmed dead assets and documentation accuracy. Calculation discrepancies affecting user decisions should be corrected before relying on those figures, even if they do not block basic ledger entry.

The application builds and passes its current tests, but **is not production-ready under this review’s approval standard**. Approval requires targeted regression gates and a disposable production-equivalent RLS/PWA/Edge run; passing the current smoke suite alone is insufficient.

### Reproduction commands

```sh
npx vitest run --config docs/functional-code-audit/vitest.config.ts
npx playwright test --config docs/functional-code-audit/playwright.config.ts
```

The reproduction files assert current defects deliberately and must not be added to normal success gates unchanged. `html-script-scan.json` records the syntax-only HTML script scan. This report and its companion checks are the only intended source-controlled additions.
