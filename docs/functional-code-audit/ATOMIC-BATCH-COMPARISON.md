# Atomic restore batch comparison (v4.3.19, 10 October 2026)

## Result and scope

The [v4.3.18 main CI run](https://github.com/dailoclaw/ev/actions/runs/38029128767) passed both `verify` and `browser-smoke` jobs. Large-restore write throughput remains an open performance concern, rather than an unresolved CI failure.

Compared request-event batches of 50, 250 (the existing implementation) and 1,000 writes using three consecutive synthetic restores per browser launch. Each restore contains 25,000 sessions with 320-character Notes, plus provider/settings operations. Chromium main-thread CPU throttle is 6. Temporary source variants were restored after the experiment; production retains batches of 250, the existing database schema and durability behavior.

| Batch size | Total save times, trial 1 / 2 / 3 (ms) | Maximum heartbeat delays, trial 1 / 2 / 3 (ms) |
|---|---|---|
| 250, initial | 3,935 / 8,040 / 11,484 | 1,024 / 1,019 / 895 |
| 50 | 3,790 / 7,941 / 11,867 | 955 / 960 / 877 |
| 1,000 | 3,832 / 8,111 / 11,768 | 1,006 / 974 / 941 |

| 250, final repeat | 3,858 / 8,061 / 11,768 | 992 / 951 / 919 |

All trials verify durable snapshot counts, pending operations and counts after data reinitialization. This does not replace failure-path checks: the final retained implementation is separately checked for late-submission rollback and retry.

Batch size has little effect on these save samples compared with the increasing times within each launch. The experiment does not establish why later trials slow down, nor isolate browser storage cost from JavaScript request processing. Trials are sequential, not randomized; the 50-write run overlapped briefly with static checking. No statistical speed guarantee or physical-device equivalence is claimed. Larger batches do not justify increasing uninterrupted submission work; smaller batches do not demonstrate a material throughput improvement. Keep 250 until target-device evidence warrants a change.

## Reproduce safely

The new standalone configuration selects the scale spec explicitly and uses only fake/local accounts. The older audit configuration selects defect reproduction tests and is not the scale runner.

```sh
# Full matrix: accepted sizes and over-limit rejection, worker and offline fallback.
npx playwright test --config docs/functional-code-audit/backup-scale.config.ts

# Repeated dense-case profiling, Chromium only for CPU throttling.
EV_BENCHMARK_CPU_RATE=6 EV_BENCHMARK_DENSE_REPEATS=3 \
  npx playwright test --config docs/functional-code-audit/backup-scale.config.ts \
  --project chromium --grep worker
```

`EV_BENCHMARK_DENSE_REPEATS` accepts integers 0–10; default 0 retains the full size/rejection matrix. Dense-only mode does not check the over-limit case. JSON output is written under `/tmp/ev-backup-<project>-<mode>-<rate>x.json` and overwritten by a subsequent matching run; preserve it before comparisons. Output contains generated fixtures only. Batch-size variants are not exposed as a production setting.

## Next work

Collect a performance trace on the intended device/browser during the atomic transaction before considering an outbox representation or schema change. Preserve complete rollback, retry, same-ID revision handling, account guards and one atomic snapshot/outbox save. A total-time requirement should be set from actual device measurements. Do not split writes into independent commits or weaken durability to improve a benchmark.

Manual Excel UI, screen-reader, physical zoom, deployed/installed PWA and managed-browser/device acceptance remain open. Disposable Supabase acceptance was removed from the active plan at the user's request and was not performed. Local automation cannot close those manual gates.

## Final verification

The original 250-write source is restored with no `cache.ts` diff. All four repeated dense benchmark invocations passed (12 successful restores). The final default matrix passed all four Chromium/WebKit worker/offline checks, including over-limit rejection, durable snapshot/outbox counts and reinitialization. Two native-browser late-batch rollback/retry checks and 43 focused backup/cache unit tests passed. Lint, TypeScript, production build, bundle budgets and whitespace checks passed. Production application behavior is unchanged apart from release metadata; no database migration, deployment or main push was performed in this step.
