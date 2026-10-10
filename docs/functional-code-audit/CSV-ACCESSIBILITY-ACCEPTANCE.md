# CSV and accessibility acceptance (v4.3.15, 10 October 2026)

## Verified results

- Current `buildCsv` output exactly matches the seven-row security fixture. Sixteen focused export/reconciliation unit tests pass.
- LibreOfficeDev 26.8.0.0.alpha0 imported the fixture, saved it back to CSV, and reopened that CSV with formula evaluation enabled. Both documents have seven data rows and six columns, numeric energy/cost/free-energy cells (10/5/0), text Notes cells and no cell formulas. Embedded delimiters and quotes remain inside Notes.
- An unprotected `=1+2` positive control evaluated to numeric 3 using identical import settings. The protected fixture's results do not rely on disabling formula evaluation.
- Fourteen Chromium/WebKit checks pass: both styles/themes, labelled fields, modal Tab/Shift+Tab containment, Escape, invoker restoration, nested achievement dismissal, chart keyboard selection, live reduced motion, core contrast and simulated 200% CSS zoom reflow.
- Excel UI validation could not run: Computer Use returned `Computer Use permissions are not granted`. No alternate UI automation or permission bypass was attempted.

## Reproduction

Use disposable outputs and a separate LibreOffice profile. These are CLI engine checks, not a claim about interactive import defaults. The [documented CSV filter options](https://help.libreoffice.org/latest/en-GB/text/shared/guide/csv_params.html) specify UTF-8, comma separators, double-quote delimiters and enabled formula evaluation:

```sh
mkdir -p /tmp/ev-csv-acceptance/imported /tmp/ev-csv-acceptance/saved /tmp/ev-csv-acceptance/reopened
soffice -env:UserInstallation=file:///tmp/ev-csv-acceptance/lo-profile --headless \
  --infilter='Text - txt - csv (StarCalc):44,34,76,1,,1033,false,true,false,false,false,0,true' \
  --convert-to ods --outdir /tmp/ev-csv-acceptance/imported \
  docs/functional-code-audit/csv-security-fixture.csv
soffice -env:UserInstallation=file:///tmp/ev-csv-acceptance/lo-profile --headless \
  --convert-to 'csv:Text - txt - csv (StarCalc):44,34,76,1,,1033,false,true,true,false,false,0,false' \
  --outdir /tmp/ev-csv-acceptance/saved /tmp/ev-csv-acceptance/imported/csv-security-fixture.ods
soffice -env:UserInstallation=file:///tmp/ev-csv-acceptance/lo-profile --headless \
  --infilter='Text - txt - csv (StarCalc):44,34,76,1,,1033,false,true,false,false,false,0,true' \
  --convert-to ods --outdir /tmp/ev-csv-acceptance/reopened \
  /tmp/ev-csv-acceptance/saved/csv-security-fixture.csv
npm test -- src/lib/exports.test.ts src/lib/analyticsReconciliation.test.ts
npm run test:e2e -- --project=chromium --project=webkit \
  --grep 'modal keyboard|trend chart supports|achievement restores|stacked|nested'
```

Inspect `content.xml` in each ODS archive: exactly eight rows including the header, six cells per row, numeric `office:value` attributes for columns C–E, string Notes cells and absent `table:formula` attributes. Repeat with a separate unprotected arithmetic control and require a formula attribute and value 3. Temporary workbook outputs remain outside the repository.

## Limits and remaining checks

The bundled LibreOffice build is a development version, not a certification of every stable release or Excel. It normalizes embedded tab/newline characters inside imported Notes; this test establishes formula protection and column integrity, not lossless text preservation. Use JSON backup for lossless data transfer. Interactive import defaults and Excel save/reopen remain manual checks.

Browser role/label assertions do not certify actual VoiceOver/NVDA announcements. CSS zoom does not certify physical browser/mobile zoom. Complete those checks on a target device; installed/deployed PWA upgrades and low-end-device import performance also remain open.

## Plan status

The next performance check is recorded in [large import acceptance](IMPORT-PERFORMANCE-ACCEPTANCE.md). It verifies durable counts under a diagnostic CPU throttle and identifies remaining main-thread stalls; it does not close physical-device acceptance.

The [v4.3.14 main CI run](https://github.com/dailoclaw/ev/actions/runs/38020447090) passed both verification and browser jobs, including production acceptance. Its earlier failure is no longer the active CI blocker; the exact historical cause was not established.

At the user's request, disposable Supabase validation is removed from the active plan and recorded as **not performed**. Live RLS, storage, Realtime, migration 008 and concurrent pagination behavior remain unverified. This scope decision does not establish full production readiness.
