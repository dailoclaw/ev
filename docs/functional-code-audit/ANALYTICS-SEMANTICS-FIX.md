# Step 6 — Analytics semantics (v4.3.10)

## Cost attribution

All-energy and provider curves retain every recorded positive-energy charge. Mixed allowance sessions attribute the cost to energy above the allowance; when the entire delivery is within the allowance but a cost was recorded, the cost is spread over that session's delivered energy. Paid-only mode includes that cost-bearing delivery. This is a chart allocation rule, not an assertion about a network's billing contract.

Zero-energy charges remain outside an energy curve. The page reports their excluded amount, including fee-only ledgers. Energy cost plus disclosed non-energy exclusions reconciles with the scoped recorded ledger cost. CSV exports and month receipts preserve original recorded costs. Savings are estimated free-energy value; they do not erase a recorded payment.

## Comparison periods

Year comparisons require consecutive calendar years and completed calendar months recorded in both years. The current month and future months are excluded. Historical selected years work under the same rule. The statement badge, Minimal effective-rate trend, year cluster and Compare panel use this scope; headline year totals continue to show the full recorded year and badges explicitly identify their completed matching-month scope. Compare's charges and net benefit use the same matched months as its cost and energy totals.

Month and quarter cluster deltas require adjacent completed periods; quarter comparisons also require records for all three months in both periods. An unfinished or missing period suppresses a delta. Home compares equal calendar-day prefixes in the current and previous month, shortening both prefixes to the previous month's length when necessary (including leap February), and labels the day count. A zero baseline or absent comparison records suppresses percentages.

Six-month Savings, Trends, Cluster and Split series include exactly six calendar months ending this month, with zero for months without records. This month's value is partial. Savings' average always divides by six; its cumulative twelve-month window carries older recorded value into its opening balance. A zero-record month describes the ledger, not proof that no charging occurred. Minimal's broader historical average is explicitly labelled an average recorded month.

## Allowances and zero cases

Both Savings styles show a separate daily allowance gauge for each active network. Home labels aggregate monthly value independently and lists each active network's daily usage. Allowances cannot transfer between networks. Archived networks still contribute historical value but do not advertise an active daily allowance. Explanations list every configured allowance, remove the invented Jolt fallback, and disclose that current settings apply retrospectively to recorded history. Per-provider historical allowance versions are not stored by this app.

Reference-rate explanations distinguish independent data from the fallback measured cost per delivered kWh on positive-cost energy rows. No paid data yields a zero estimate. The zero-budget thermometer explicitly maps zero spend to 0% and positive spend to 100%, avoiding invalid CSS widths.

## Verification

- 255 unit tests pass across 23 files; core coverage is 99.45% of lines and 88.42% of branches. Unit tests cover calendar gaps, empty history, changing allowances, multiple/archived providers, leap February, unmatched years, ongoing months, selected historical years, fee-only and zero-baseline comparisons, positive cost within allowances, and scoped cost reconciliation.
- Reconciliation test checks enriched receipts, CSV costs, monthly totals, concentration costs plus exclusions, and derivation values together.
- The full browser run passed all 64 existing regressions. The 12 new analytics checks pass in targeted reruns, including a narrow-screen statement layout check. Browser regressions exercise both styles and Chromium/WebKit with the isolated fake backend, including separate allowance gauges, cost-bearing covered energy and fee exclusions, empty history and zero budgets.
- Lint, TypeScript, coverage thresholds, production build and existing bundle budgets pass. The audit's nine isolated reproduction checks pass after converting the disappearing-cost example to a regression.

Live Supabase/RLS/storage, physical-device performance, production service-worker and cross-tab conflict acceptance remain open from earlier steps. Security and accessibility work is next in Step 7. These local fixes do not certify the entire app as production-ready.
