# Step 7 — Security and accessibility (v4.3.11)

## Dependency fixes

The live npm advisory check identified two high-severity dependency findings. A compatible `npm audit fix --ignore-scripts` updated every vulnerable resolution: brace-expansion 1.1.18 → 1.1.21, 2.1.4 → 2.1.7 and both 5.0.9 copies → 5.0.12; source-map-js 1.2.1 → 1.2.2. No direct dependencies or major-version declarations changed. A normal `npm ci` verifies the final lockfile, and `npm audit --audit-level=high` reports zero vulnerabilities. The installed glob package emits a deprecation notice; the current npm advisory check reports no remaining vulnerability for this graph.

## CSV serialization

String fields with ASCII/full-width formula prefixes are neutralized even after leading whitespace, BOM or controls. Leading controls are also neutralized independently. CR, LF, tabs, commas, semicolons and embedded double quotes are serialized within quoted fields; numeric energy/cost/free-energy columns preserve their values. Regression fixtures parse the resulting cells and verify row/column boundaries and literal prefixes.

This follows the initial-import mitigation described by [OWASP CSV injection guidance](https://community.owasp.org/attacks/CSV_Injection). OWASP notes that spreadsheet save/reopen behavior can remove protective characters and that no strategy is universal. The exported JSON backup remains the lossless data-transfer format.

Actual Excel validation is **not completed**: Computer Use reports that Accessibility and Screen Recording permissions are pending. No permission bypass or alternative UI automation was used. A harmless arithmetic-only [CSV fixture](csv-security-fixture.csv) is provided for manual acceptance:

1. Open/import the fixture in Excel and LibreOffice using their normal CSV paths.
2. Confirm seven data rows and six columns; costs must remain numeric 5.00 and energy numeric 10.
3. Confirm Notes cells display text, not the computed result 3; inspect formula bars and cell types for immediate, whitespace/control-prefixed and full-width examples.
4. Confirm the embedded quote/comma/semicolon text stays in a single Notes cell.
5. Save and reopen a disposable copy and repeat. If the application strips the protective prefix, import text columns explicitly as Text and record the limitation before approving that workflow.

## Modal and keyboard behavior

A shared portalled native `dialog.showModal()` shell now powers Add, Edit, Receipt, Explain, What's New, Record Details and Achievement dialogs. Browser top-layer behavior makes the background inert and supports stacked dialogs. The shell supplies a visible close control, explicit Tab/Shift+Tab wrapping, Escape cancellation, initial focus, invoker restoration and reference-counted scroll locking. A declarative focus fallback returns Edit to the visible row Actions button when its original action becomes inert. Dismissal is temporarily disabled during a durable save. Existing save/retry/backdrop flows remain available. Duplicate global Escape handlers were removed so a keypress dismisses only the top dialog.

Achievements remain open until the user dismisses them; their records remain available in Vehicle. This gives users time to read without the old 3.8-second modal timeout. Shared behavior follows the [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

If a successful Add form closes automatically underneath an achievement, the final dismissal returns focus to Add charge when its original invoker has disappeared or become the page body. A real save-flow regression covers this sequence in both browser engines.

Charge/Edit inputs have associated field labels and error descriptions. Charger and colour controls announce selection state; existing vehicle/provider steppers retain their contextual names. The budget slider has a currency label and value text. Trend-chart points expose button semantics and current selection, with Enter/Space, Left/Right and Home/End keys.

## Zoom, contrast and motion

The viewport no longer disables zoom, and segmented controls, swipe rows and the concentration chart permit pinch zoom. Decorative segmented-control lenses are clipped within their controls to prevent scaled shadows from expanding page width. Secondary text tokens, light-theme positive/negative colours and the Savings card gradient are darkened to meet normal-text contrast on canvas/surface backgrounds. Focus outlines cover form controls and interactive chart points. Browser checks measure the active theme's core text-token contrast against its three solid surface tokens; Savings small-text contrast is also checked at all three gradient stops with its opacity. This is not a complete audit of photographs, decorative compositing or arbitrary provider colours.

Count-up, donut, ring, thermometer, split bar, unit roll, segmented control and analytics animations subscribe to the existing reactive reduced-motion store. Live changes cancel or bypass animation rather than waiting for remount. CSS reduced-motion rules continue to apply.

## Acceptance limits

Verification: 270 unit tests pass, with core coverage of 99.45% lines and 88.42% branches. The complete 88-test browser suite passed before the final contrast, pinch-zoom and nested-focus refinements; subsequent targeted runs cover those changes. Nine isolated audit reproductions pass. Lint, TypeScript, production build and bundle budgets pass, and npm reports zero vulnerabilities.

Automated unit and browser checks cover the implemented behavior against a fake backend. The 200% enlargement test uses CSS zoom at a 780-pixel viewport to exercise a 390-pixel effective layout; it does not certify OS/browser zoom or mobile text enlargement. Independent VoiceOver/NVDA reading order, announcements and actual Excel/LibreOffice save/reopen checks remain open. Step 7's complete manual acceptance gate is therefore still open. Production CSP, installed PWA, deployed schema/RLS/storage and managed Microsoft Edge acceptance belong to Step 8 and remain unverified.
