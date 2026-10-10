# CI acceptance follow-up (v4.3.14, 10 October 2026)

## Actual main-branch results

The [v4.3.13 CI run](https://github.com/dailoclaw/ev/actions/runs/38017914387) completed with failure. Its public job/annotation APIs confirm:

- Static verification succeeded: install, lint, TypeScript, coverage, production build, bundle budgets and dependency audit.
- Chromium, WebKit and branded Microsoft Edge installed successfully on the Ubuntu runner.
- Development browser regression succeeded: 135 tests passed in 6.7 minutes, including the added Edge project.
- The subsequent production-browser step failed. Public log download returned HTTP 403; its existing list-only reporter provided no specific failed-test annotation. The exact remote failure is therefore **not diagnosed or claimed fixed**.

The immediately preceding v4.3.12 run also failed; v4.3.11 succeeded. These are current observed CI results, not an inference from local tests. Local changes in this follow-up have not been pushed or run on GitHub.

## Local follow-up

The original production suite passes locally under `CI=1` for Chromium/WebKit (seven passed, the existing WebKit offline-navigation case skipped). This does not reproduce the Ubuntu/Edge failure.

Code inspection identifies a reconnect-test race independently: the cold-start test requires clicking Retry after bringing the context online, although successful automatic recovery may already have removed that button. The test now exercises automatic recovery directly by emitting the online event when automation omits it, then requires a synced badge and an empty durable outbox. The worker-replacement test retains explicit manual-retry coverage. This is a concrete test correction, but it must not be presented as the proven cause of the remote failure without logs or a successful rerun.

The production config emits GitHub failure annotations, a list log and an HTML report in CI. The workflow preserves test results/traces and the production report for seven days when the browser job fails. Production checks run after a development-test failure unless the job was cancelled. Fixtures use only fake/local accounts; credentials and real ledger exports are not added to artifacts. README commands now describe Edge and the production suite accurately.

## Follow-up verification

The updated v4.3.14 production suite passes locally under `CI=1`: seven passed, one existing WebKit offline-start case skipped. Its HTML report and GitHub summary were generated. Lint, TypeScript, production build, bundle budgets and whitespace checks pass. The workflow artifact-upload path has been reviewed but cannot be verified on GitHub before a remote run. No full app/unit rerun was needed for this test/reporting-only change; application logic and dependency versions are unchanged.

## Next acceptance sequence

1. Review/push the v4.3.14 follow-up, then inspect its actual GitHub result. Require both verification and browser jobs to pass; inspect annotations/artifacts on any failure. A workflow change alone does not certify remote success.
2. If the current run log is available earlier, identify the actual failing production assertion and resolve that specific cause. Preserve genuine failure signals rather than weakening assertions or adding broad retries.
3. Supply the intended preview URL and an explicitly disposable Supabase project with local test credential file locations. The current linked project/browser configuration is not evidence that it is safe to use for destructive test fixtures. No migrations or test writes were performed against it.
4. Complete migration 008, RLS/private-storage/Realtime/pagination and deployed/installed PWA acceptance using the [Step 8 checklist](PRODUCTION-VALIDATION.md).
5. Complete the spreadsheet, screen-reader and physical zoom checks in [Step 7](SECURITY-ACCESSIBILITY-FIX.md).

Production approval remains pending. No deployment, database migration, permission bypass or main push was performed in this follow-up.
