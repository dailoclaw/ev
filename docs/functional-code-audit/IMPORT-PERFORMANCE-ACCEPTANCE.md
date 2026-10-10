# Large import performance acceptance (v4.3.16, 10 October 2026)

## Scope

The expanded standalone benchmark exercises the current application modules in a desktop browser with real local IndexedDB and no live ledger writes. It checks worker reading and the navigator-offline main-thread fallback independently, uses valid UUIDs and adds a 25,000-row case with 320-character Notes. Chromium's main-thread CPU throttle is set to 6 through CDP. This is a diagnostic slowdown, not a calibrated physical low-end device; native storage and worker CPU are not independently calibrated.

Both throttled checks pass their integrity assertions. Accepted cases retain the exact session count in the durable snapshot and after data-module reinitialization, with one queued operation per charge plus provider/settings operations. The 25,001-row input is rejected with an empty snapshot and queue. Reinitialization is not a browser-process restart.

The four unthrottled worker/offline checks also pass across Chromium and WebKit. Lint, TypeScript/production build, bundle budgets and whitespace checks pass for the final benchmark/documentation changes. The v4.3.15 main CI run remains in progress at this check; local benchmark success is not its remote result.

## Single-sample measurements

Times are milliseconds. Timer delay is the maximum excess over a 20 ms heartbeat during read/preview/save; it indicates main-thread stalls, not every rendered frame or physical-device latency. Fixture generation, queue inspection and reinitialization are outside the timed phases. Dense input size is 10,700,349 bytes, below the simultaneous 15 MB input/canonical export bound.

| Path | Rows | Notes length | Read | Preview | Durable save | Max timer delay |
|---|---:|---:|---:|---:|---:|---:|
| Worker | 1,000 | 0 | 31 | 26 | 127 | 76 |
| Worker | 10,000 | 0 | 58 | 182 | 735 | 665 |
| Worker | 25,000 | 0 | 99 | 432 | 4,243 | 1,646 |
| Worker | 25,000 | 320 | 131 | 538 | 10,015 | 1,914 |
| Offline fallback | 1,000 | 0 | 22 | 19 | 104 | 77 |
| Offline fallback | 10,000 | 0 | 164 | 178 | 798 | 797 |
| Offline fallback | 25,000 | 0 | 316 | 402 | 4,221 | 1,872 |
| Offline fallback | 25,000 | 320 | 340 | 421 | 9,893 | 2,003 |

The row ceiling is an integrity/resource limit, not a promise of responsive imports at that size. Moving file parsing into a worker does not eliminate restore planning, serialization or IndexedDB structured-clone work on the main thread. Dense maximum-size restores remain a performance concern. No data limit was lowered from these single desktop samples, and existing data is not truncated.

## Reproduction

```sh
EV_BENCHMARK_CPU_RATE=6 npm run test:e2e -- --config docs/functional-code-audit/backup-benchmark.config.ts --project=chromium
npm run test:e2e -- --config docs/functional-code-audit/backup-benchmark.config.ts --project=chromium --project=webkit
```

Results are written outside the repository to `/tmp/ev-backup-<project>-<worker|offline>-<rate>x.json`. CPU throttling is supported only on Chromium projects; invalid rates and incompatible projects fail explicitly. The two paths run serially in fresh test contexts.

## Remaining work

1. Profile dense restore preparation separately from IndexedDB request submission/commit to identify the dominant stalls.
2. Reduce repeated normalization/serialization only where shared validated data can preserve preview/save agreement and account-state guards.
3. Evaluate bounded IndexedDB request submission with explicit transaction-lifetime handling. Retain atomic snapshot/outbox writes, quota-error rollback and newer-write ordering; splitting a restore into independently committed batches is not acceptable.
4. Repeat measured samples after changes, including notes/photo-heavy inputs near the byte limit, failure injection and final queue/snapshot comparison.
5. Test a physical low-end target device for memory pressure, process reopening and user-visible responsiveness before closing that acceptance gate. Screen-reader, physical zoom and deployed/installed PWA checks also remain manual. Supabase validation remains removed from the active plan and not performed.
