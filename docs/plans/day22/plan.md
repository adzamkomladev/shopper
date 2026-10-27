# Day 22 · Reporting & dashboards

## Context

Notion row "22 · Reporting & dashboards" (moved to Tue 27 Oct after Day 21 slipped a day). Today the portal
has no sales reports at all: the only report is the till's per-register dashboard (`packages/core/src/till/reports.ts`),
and the tax area folds raw sale lines on every read. Owners need to run the business from the portal (milestone
Tue 27 Oct): KPIs, sales by every dimension, margin, dead stock, branch comparison, exports for the accountant,
and the store's day driven by a workflow rather than by people remembering. Day 21 left one obligation: **every
sales/refund report must honour `branchScope`.**

The tasks, tests and done-bar from Notion:

- Store-day Workflow per store: `sleepUntil` opening → `sleepUntil` closing → Z-report reminder → owner summary →
  nightly rollup → archive → create tomorrow's instance.
- The daily watchdog cron restarts any store-day chain that died (still the only cron).
- Nightly rollups through the Workflow port (Cron Trigger + Workflows in cloud, timer + in-process engine on the box).
- Dashboard KPIs: today vs yesterday, basket size, top products, tender mix.
- Sales by day / hour / branch / cashier / tender; product performance; margin; dead stock; branch comparison.
- CSV + Excel export on every report; accountant journal feed.
- Tests: rollups equal raw aggregates for the fixture month; export row counts match the query.
- Done when reports load in < 1.5 s on a year of data.

Your decisions (27 Oct): hours **per store, 07:00–21:00 default**, edited in the Stores sheet · reminder and
summary go to **owners by email** (the audit-anchor audience and mail path) · cost = **last costed receipt at that
branch on or before the sale day**, uncosted lines flagged · dead stock = **on hand > 0 and no sale in 30 days**
(30/60/90 picker). Data is disposable: migrations may assume an empty or reset database.

Working mode (your instructions): this session only, no subagents (Opus medium does all work, including review
driving and UI verification). Tests first, then implementation, then test runs and fixes. One commit per slice on
branch `day22-reports`, Codex review per slice and for the whole branch, push only at the end, PR, watch CI to
green (auto-fix and re-push on failure), merge, then update Notion.

## Design

### Data (migration `0030_reports.sql`, forward-only, idempotent)

- `store.opens_at time NOT NULL DEFAULT '07:00'`, `store.closes_at time NOT NULL DEFAULT '21:00'`,
  check `closes_at > opens_at` (Accra = UTC all year, so the times are UTC).
- `store_day` (tenant, `store_id`, `day date`, `status` open|closed, `opened_at`, `closed_at`, `rolled_at`,
  `summary jsonb`), unique `(org_id, store_id, day)`. This is the record the workflow mirrors into, and
  `rolled_at IS NOT NULL` is "this day's rollup is current".
- Three rollup tables, each keyed by `(org_id, store_id, branch_id, day, …)`, money as `moneyColumn`, quantities
  in thousandths, indexed `(org_id, day)` and `(org_id, branch_id, day)`:
  - `report_sales` … `hour smallint, cashier_id` → sales, items, gross, discount, tax, net, refunds, refund gross, refund tax.
  - `report_tender` … `kind` → count, amount (net of change), refunded.
  - `report_product` … `product_id` → quantity, gross, net, tax, cost (costed lines only), uncosted quantity,
    refund quantity, refund gross.
- Definitions: day = `occurred_at AT TIME ZONE 'Africa/Accra'`; gross = line `tax.gross`; tax = vat+nhil+getfund+covid;
  net = `tax.base`; margin = net − cost. All arithmetic stays in PostgreSQL bigint and comes back through
  `fromBigInt` (as `foldTax` does). Refunds count on the day they are made (as credit notes do in `foldTax`).

### One fold, two uses — equality by construction, freshness by a dirty bit

- `packages/core/src/reports/fold/{sales,tenders,products}.ts`: one SQL fold per grain over raw `sale`,
  `sale_line`, `sale_tender`, `refund`, `refund_line`, for a store set and day range. Product cost joins the
  latest costed `stock_movement` receipt at the branch with `occurred_at` on or before the day (reuse the
  `lastCosts` query shape from `packages/core/src/stock/valuation.ts`, made date-bounded).
- `reports/rollup.ts` (`rollStoreDays` command): for one store, every day with `rolled_at IS NULL` up to the
  given day: delete that day's rollup rows, `INSERT … SELECT` the fold, set `rolled_at`. Idempotent; audited.
- Late data: `acceptSale` (`packages/core/src/sales/accept.ts`) and refund accept clear `store_day.rolled_at`
  for their store/day in the same transaction (one indexed update). An offline till uploading yesterday's
  sales makes yesterday raw again until the next night's rollup re-rolls it.
- `reports/read.ts`: readers `UNION ALL` the rollup rows of rolled days with the live fold of the rest (today,
  dirty days), then aggregate per report. So reports are always exact, and fast where rolled.
- Every reader takes `branchScope(principal)` and the optional `branchId` (`assertBranch`), like
  `taxSummary`. Range ≤ 366 days (Valibot schema in `core/src/schemas/reports/`).

### Reports (`packages/core/src/reports/`, API `packages/api/src/routes/reports/*.ts`, `report.read`)

| Endpoint                                                                    | Content                                                                                                                                                                          |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /reports/dashboard?day&branchId`                                       | sales, transactions, basket size (gross/transactions), items per basket, refunds, unique customers — each with yesterday and % change; top 5 products; tender mix; sales by hour |
| `GET /reports/sales?from&to&by=day\|hour\|branch\|cashier\|tender&branchId` | grouped rows plus a total row                                                                                                                                                    |
| `GET /reports/products?from&to&branchId&sort`                               | quantity, gross, net, cost, margin, margin %, uncosted flag                                                                                                                      |
| `GET /reports/dead-stock?days=30\|60\|90&branchId`                          | on hand > 0 (stock ledger), last sale day, days since, value at last cost; archived products excluded                                                                            |
| `GET /reports/branches?from&to`                                             | branch comparison: sales, transactions, basket, margin, refunds, share of total                                                                                                  |
| `GET /reports/journal?from&to&branchId`                                     | accountant journal: per day and branch, Dr cash/MoMo/card/customer credit/loyalty, Cr sales (net), VAT, NHIL, GETFund, COVID, cash rounding; refunds reversed; debits = credits  |

Each has `/export.csv` and `/export.xlsx` from one helper (`reports/export.ts`: columns + rows → `toCsv` from
`@shopper/utils`, or an `xlsx` sheet as in `tax/reports/workbook.ts`; amounts in cedis to the pesewa). Store hours
are set through the existing store update command and `PUT` in `routes/management.ts`.

### Store-day workflow (`packages/core/src/workflows/day.ts`, logic in `core/src/reports/day/*.ts`)

Instance id `store-day_<orgId>_<storeId>_<YYYY-MM-DD>` (the form `platforms.md` already documents). Every step is a
`defineCommand` that writes its table, an audit row and `workflow_run` (the `publishAnchors` pattern).

1. `open` step: upsert `store_day`, read the store's hours → checkpointed `opensAt`/`closesAt` (an hours edit takes effect the next day).
2. `sleepUntil("opening")` → `opened` step (status open, `opened_at`).
3. `sleepUntil("closing")` → `z-reminder` step: open shifts at the store's branches; if any, queue `store-day.reminder` per owner.
4. `summary` step: the day's dashboard figures into `store_day.summary`; queue `store-day.summary` per owner.
5. `sleepUntil("night")` (00:05 the next day, so the whole day is in) → `rollup` step: `rollStoreDays` (also catches up days a dead chain missed).
6. `archive` step: status closed, `closed_at`; the summary is frozen.
7. `next` step: start tomorrow's instance through the launcher (an existing id is a no-op).

Delivery: `deliverNotification` (`core/src/notifications/deliver.ts`) gains the two types; plain-text mail like
`deliverAuditAnchor`, linking to `/reports` and `/shifts`. Without mail or a base URL the message retries.

Watchdog (`runWatchdog`, `core/src/audit/anchor.ts` → moved to `core/src/workflows/watchdog.ts` since it now
owns two chains): at 23:59 UTC also starts today's and tomorrow's store-day for every store. No subscription chain
exists yet (billing is later), so there is nothing else to restart. New stores: the store create route starts
today's instance after commit.

Shells:

- Cloudflare: `StoreDayWorkflow` in `packages/adapters/cf/src/workflows/day.ts` (the `AuditAnchorWorkflow`
  shape plus a launcher on its own binding); `STORE_DAY` binding + export in `apps/edge/cloudflare.config.ts`;
  `cloudflareWatchdog` env gains `STORE_DAY`.
- Box: `boxStoreDays` in `packages/adapters/box/src/workflows/day.ts` (the `boxAuditAnchors` shape), wired into
  `boxWatchdog`; on boot the box starts today's store-days (the in-process engine forgets running sleeps on restart).
- No port changes, no new DO, no new cron, no new dependency (charts are plain CSS bars with `@shopper/ui` tokens).

### Portal (`@shopper/backoffice`)

- Nav: `Reports` (`BarChart3Icon`, `report.read`) in `lib/shell/nav/items.ts`, `also` its sub-pages.
- Routes `routes/reports.tsx` (pattern of `routes/tax.tsx`: `whenHeld`, prefetch, lazy screen, skeleton):
  `/reports` dashboard, `/reports/sales`, `/reports/products`, `/reports/dead-stock`, `/reports/branches`, `/reports/journal`.
- Screens `screens/reports/<context>/screen.tsx`, components `components/reports/<context>/`, queries
  `queries/reports/`, search schemas `schemas/reports/`.
- Figma: the dashboard follows `339:9672` (title, segment tabs, date-range button, Download, KPI tiles with
  "vs yesterday", a side card in place of Quick Actions for top products and tender mix). Tables follow 45:852
  ("Previous purchases": segment tabs with counts, search, table) and 99:1511's "Export CSV" button; inputs and
  tokens follow 12:66; responsive tab behaviour follows 227:4900. No report frames exist — noted in remarks.
- Every state: loading (skeletons measured with `/skeleton-audit`), empty (no sales in range), error, offline,
  no permission, scoped member (branch filter limited to their branches), uncosted margin badge.
- Keyboard: `1`–`6` report tabs, `[`/`]` previous/next period, `E` export menu, `/` filter, `B` branch picker.
- Stores sheet gains Opens/Closes time inputs.

## Slices (tests first in each; commit after each, Codex review before each commit)

| #   | Slice                                    | Tests written first                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Main files                                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Schema + folds + rollup + dirty bit      | `tests/integration/reports/rollup.test.ts`: the fixture month (golden `tradingDay` replayed through the real sale path on 30 days, 2 branches, 2 cashiers, refunds on 3 days, costed receipts) gives identical results for every report fully rolled vs fully raw, and matches golden totals × days to 1/10000; a late sale after rollup clears `rolled_at` and still appears; re-rolling is idempotent; audit chain verifies                                                                                                                                                                                            | `db/pg/src/schemas/reports.ts`, `migrations/0030_reports.sql`, `core/src/reports/{fold/*,rollup,read}.ts`, `sales/accept.ts`, refund accept                                                                                                                                          |
| 2   | Report queries + API + scope             | `reports/sales.test.ts` (each `by`, exact totals, hour buckets in Accra time), `reports/products.test.ts` (margin uses the receipt on/before the day, not a later one; uncosted flagged; dead stock 30/60/90, archived excluded), `reports/dashboard.test.ts` (today vs yesterday, basket, top 5, tender mix net of change), `reports/scope.test.ts` (scoped member sees only their branches; foreign branchId 403; no `report.read` 403; range > 366 → 400)                                                                                                                                                             | `core/src/reports/*.ts`, `core/src/schemas/reports/*.ts`, `api/src/routes/reports/*.ts`, `api/src/app.ts`                                                                                                                                                                            |
| 3   | Exports + journal                        | `reports/export.test.ts`: CSV and XLSX row counts equal the JSON rows for every report; journal debits = credits per day and branch, and its tax lines equal `taxSummary` for the range                                                                                                                                                                                                                                                                                                                                                                                                                                  | `core/src/reports/{export,journal}.ts`, export routes                                                                                                                                                                                                                                |
| 4   | Store-day workflow + watchdog + delivery | `workflows/day/flow.test.ts` (steps in order, reminder only when a shift is open, summary stored and queued per owner, rollup done, closed, tomorrow started with the right id/params, a rerun sends nothing twice, `workflow_run` + audit rows); `workflows/day/watchdog.test.ts` (starts today+tomorrow per store and the anchors, second firing no-op); `workflows/day/box.test.ts` (box shell + boot start); delivery mail content test with the Maileroo fake; `tooling/worker/tests` StoreDayWorkflow in workerd (sleeps disabled) and the scheduled handler starting `STORE_DAY`; `edge.test.ts` pins the binding | `core/src/workflows/{day,watchdog}.ts`, `core/src/reports/day/*.ts`, `core/src/notifications/deliver.ts`, `adapters/cf/src/{workflows/day,watchdog}.ts`, `adapters/box/src/workflows/day.ts`, `apps/edge/cloudflare.config.ts`, `apps/box` wiring, store hours in management command |
| 5   | Speed                                    | `reports/speed.test.ts` (heavy group): a year of sales for 2 branches generated by SQL, rolled by the real rollup, then every report over the year and the dashboard each answer in < 1.5 s through the API, and totals equal a direct aggregate                                                                                                                                                                                                                                                                                                                                                                         | `vite.config.ts` heavy list, indexes tuned with `EXPLAIN`                                                                                                                                                                                                                            |
| 6   | Portal                                   | `tests/e2e/portal/reports/{dashboard,sales,products,exports,scope}.spec.ts` and `stores/hours.spec.ts`: tiles and deltas, tab switching by keyboard, period stepping, export downloads with the right row count, empty/error states, scoped admin's branch list, nav hidden without `report.read`, hours saved                                                                                                                                                                                                                                                                                                           | `backoffice/src/{routes/reports.tsx,screens/reports/*,components/reports/*,queries/reports/*,schemas/reports/*}`, nav items, stores form                                                                                                                                             |
| 7   | Docs                                     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `docs/engineering/platforms.md` (store-day, watchdog's two chains, rollups), `docs/plans/day22/{plan,verification}.md` + screenshots                                                                                                                                                 |

Break-it checks (each must go red, then revert): rollup drops refunds; reader ignores the dirty bit; cost uses the
latest receipt regardless of date; export drops the last row; journal omits cash rounding; reminder sent with no
open shift; watchdog skips tomorrow; reader ignores `branchScope`.

## Verification

- Per slice: the slice's tests red first, then green; `vp check`; `vp run guard`; then
  `codex review --uncommitted -c model="gpt-6.1-sol" -c model_reasoning_effort="medium"` (per the
  `pre-merge-review` skill), verify each finding, fix with a red-first test, commit.
- Services: `vp run services:up`, reset and `vp run db:migrate`, `vp run db:seed` (the database is disposable).
- Full run: `vp test --run`, `vp run build`, worker suite.
- UI: `/ui-verify` with `playwright-cli` against `vp run dev` at desktop 1920, laptop 1440/1366, tablet 768,
  mobile 390 and till sizes: every state, keyboard-only path, console clean, no overflow; `/skeleton-audit` for
  each report skeleton; compare with 339:9672 and 45:852.
- Whole-branch Codex review: `codex review --base main -c model="gpt-6.1-sol" -c model_reasoning_effort="medium"`.
- Push `day22-reports`, open the PR (no assistant attribution), bind it, watch CI to green; on failure fix, commit,
  push again; merge when green; fast-forward local `main`.
- Notion: Day 22 row → Status Done, with remarks in the Day 21 format (status, decisions, shipped, tests,
  review fixes, upgrade notes: migration `0030_reports`, new `STORE_DAY` workflow binding, deploy edge + portal
  together; known limits: summary for a day whose chain died is not sent, hours edits apply next day, box
  in-process engine until Day 36, no report Figma frames).
