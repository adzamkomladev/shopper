# Day 22 verification

What was run to prove the reporting work, and the checks that went red on purpose first. The plan is in
[plan.md](plan.md).

## Integration (Postgres 18 fixture)

Run: `vp test --run tests/integration/reports --exclude "**/speed.test.ts"` → 9 files, 50 tests passed (27 Oct).
The speed test runs in the heavy group: `vp test --run tests/integration/reports/speed.test.ts` → 13 passed.

| File                        | What it proves                                                                                                                                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reports/rollup.test.ts`    | The fixture month gives identical figures rolled and raw; a late sale clears `rolled_at` and still shows; re-rolling is idempotent; the audit chain verifies                                                                             |
| `reports/sales.test.ts`     | Every grouping (day, Accra hour, branch, cashier, tender) with exact totals; split tenders count a sale once                                                                                                                             |
| `reports/products.test.ts`  | Margin uses the receipt on or before the sale day, never a later one; refunds cost at their sale's day and branch; uncosted lines flagged; dead stock 30/60/90 as of a day, archived excluded                                            |
| `reports/dashboard.test.ts` | Today against yesterday, basket, top five, tender mix net of change with labels and shares, 24 Accra hours                                                                                                                               |
| `reports/scope.test.ts`     | A scoped member sees only their branches in every report and the branch picker; another branch by id is 403; no `report.read` is 403; ranges over 366 days and impossible dates are 400                                                  |
| `reports/export.test.ts`    | CSV and Excel hold the JSON report's rows then its total for every report; amounts to 1/10000 cedi, Excel as numbers; the journal balances per day and branch and its levies equal the tax summary                                       |
| `reports/day/*.test.ts`     | The store-day steps in order, the reminder only when a register sold after its Z, summary stored and mailed per owner, rollup, close, tomorrow started, a rerun sends nothing twice; watchdog starts today and tomorrow; hours validated |
| `reports/speed.test.ts`     | A year of sales for two branches, rolled by the real rollup: every report and the dashboard answer in under 1.5 s through the API, and totals equal a direct aggregate                                                                   |

Worker suite (workerd): `tooling/worker/tests/reports/day.test.ts` runs `StoreDayWorkflow` with sleeps disabled.

## Portal (Playwright, e2e stack)

Run: `vp run e2e tests/e2e/portal/reports tests/e2e/portal/stores --project=portal` → all passed (27 Oct). Each
filled state is the API's answer replayed; quiet states, exports and permissions use the real API. Screenshots at
1920, 1440, 1366, 768 and 390 with an axe pass and an overflow check are in [screenshots](screenshots).

- Dashboard: tiles with "vs yesterday", best sellers, tender mix and hour bars; a quiet day; offline (export
  disabled, figures kept); server unreachable then Try again; a cashier sees no permission and no nav link.
- Keyboard: `[` `]` step the period, `1`–`6` switch reports, `E` then `C` and Enter downloads the CSV and the
  keys still work after it, `/` filters products.
- Tables: sales by day with the total last, a quiet range and its CSV (every day plus the total), products with
  missing-cost badges, dead stock windows, branches with shares, the journal balanced, ranges over a year pulled
  in to one year.
- Stores: opening and closing times saved, closing before opening refused on Closes.

## Break-it checks

Each was broken on purpose, watched go red, then restored:

- The reader ignoring `rolled_at` → the late-sale rollup test fails.
- Reports ignoring `branchScope` → the scope tests fail.
- The journal without cash rounding → the 16 Oct rounding assertion fails.
- The export dropping its last row → every export row-count test fails.
- The reminder sent with every register closed → the flow test fails.
- The watchdog skipping tomorrow → the watchdog test fails.

## Codex findings fixed (gpt-6.1-sol)

- Reports: negative denominators in shares and changes; historical dead stock reading later movements; refunds
  costed on the refund day; duplicate rollup keys per cost; impossible dates; the split-tender total;
  uncosted refunds; the box relaunching unfinished days; `/reports` routed to the public API.
- Portal: a range over a year trapped the page on an error (now pulled in to 366 days); hours that refunded more
  than they sold drew no bar (now drawn in the destructive colour).

Rejected: a forward migration for `0030_reports` (unreleased, data disposable); filtering the store summary by
branch reassignment mid-day (an unlikely edge, noted as a limit).

## Known limits

- A branch moved between stores mid-day splits that day's summary.
- Hours edits apply from the next day.
- The box runs the store day on its in-process engine until Rivet (Day 36).
- No report frames exist in Figma; the dashboard follows 339:9672 and the tables the list pattern.
- No worker test drives the scheduled handler itself.
- On a 390 px phone the journal's amount sits close to the table edge.
