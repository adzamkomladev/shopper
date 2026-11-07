# Day 35 plan · Catch-up + pilot feedback

Branch `day35-catchup` off `main` (e2c6f43). Data is disposable: migrations may change constraints without a backfill, and local
Postgres, D1, KV and DO state may be wiped (`vp run db:reset`-style) whenever that is simpler.

## Context

Notion row **35 · Catch-up + pilot feedback** (Phase 5, Catch-up, surfaces Till + Shop). Tasks: finish what Days 29–34 left
open, triage pilot issues, shop polish, a Rivet warm-up for Day 36, weekly review.

- Day 29 (pilot install) is an on-site day and no pilot issues are logged in Notion, so there is nothing to triage in code.
  Days 27/28 statuses belong to the Windows/on-site work; I will not change them.
- Days 30–34 are Done, but three days in a row carried the same **known limits**. Day 35 closes them, in priority order:

| #   | Gap (where it was reported)                                                                                               | Why it matters                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| S1  | Online orders absent from **every report** (sales, tenders, products, dashboard, branches, store-day email) — Days 33, 34 | Owner's numbers are wrong as soon as one online order is paid |
| S2  | Online orders absent from the **transactions explorer** — Days 33, 34                                                     | Staff cannot find an online sale by receipt or phone          |
| S3  | Shop order page shows the **first-ordered totals** beside the "Your order changed" card — Day 34                          | Shopper sees two different totals                             |
| S4  | Review SMS has **no link**; there is no shop URL setting — Day 34                                                         | Reviews will barely happen                                    |
| S5  | Paystack's **MoMo code (OTP) step** is not offered online; the attempt fails — Day 33                                     | Some MoMo payers cannot pay online at all                     |

Skipped (say so in Notion): Hubtel refunds stay manual (no refund API to call), courier tracking, ask-before-substitute,
offline till selling a held unit, box in-process waits (Day 36 Rivet). The Rivet warm-up is reading, not code.

Figma: the MCP is over its plan limit (checked: tool-call limit error). S2/S3/S5 follow existing patterns — the explorer
table and status badge, the shop order page, the pay panel. Frames are retried once at UI time; if still limited, noted.

## How I work (per your instructions)

No subagents. Per slice: write the failing integration/e2e test first (`tdd-slice` skill), break-check it, implement,
run the slice's tests, `vp check`, `vp run guard`, commit. UI slices run the `ui-verify` loop with `playwright-cli`
(1920, 1440, 768, 390 and till size; keyboard path, console, overflow). Before push: `codex review` (gpt-6.1-sol) run
directly (the `pre-merge-review` checklist), fix findings with tests. Push once, open PR, bind with ccd_pr, watch CI,
fix and re-push until green, squash-merge. Then update the Notion Day 35 page (tasks ticked, Progress, Remarks) and
write `docs/plans/day35/{plan,verification}.md` + screenshots.

## S0 · Migration `0041_online_reports.sql`

- `fiscal_doc.items jsonb` (nullable): the document's goods as `[{ productId, tax: TaxSnapshot }]`, filled for the four
  online documents (order invoice, `-S` supplement, `-A` credit, `-C` refund). Receipts have no product id per line, and
  re-deriving `quoteMissing` in SQL would duplicate `goodsOf`; storing what the command already computed is exact.
- `report_sales.cashier_id` nullable (online sales have no cashier); its unique key becomes `NULLS NOT DISTINCT`.
- Drizzle schema in `packages/db/pg/src/schemas/{fiscal,reports}.ts`; SQLite schema only if `report_sales` exists there.

## S1 · Online orders in every report

Tests first — `tests/integration/reports/online.test.ts` (reuse the Day 34 order fixtures from
`tests/integration/orders/fulfil`): one till sale + one paid online order, then a short pick with a substitute, then a
full refund of another order. Assert, for the live fold **and** after `rollStoreDays` (both must agree):

- `salesReport` by day/branch/hour/cashier/tender: gross, tax by levy, net, refunds; online sales appear under cashier
  "Online shop"; card/momo tenders carry the order money and its refunds.
- `productsReport`: ordered, substituted and short products with quantity, gross and refund quantity.
- dashboard and store-day report totals include the order (both read the same folds — one assertion each).
- A late paid order marks its store day stale (rollup refolds it).

Implementation (all three reports, dashboard, branches and the day email read `reportSource` → the three folds, so
the folds are the only change):

- `packages/core/src/reports/fold/sales.ts`: add a `UNION ALL` over `fiscal_doc` rows with no `sale_id`/`refund_id`:
  invoices count as sales (`sales = 1` only for the order invoice, 0 for a `-S` supplement), credit notes as refunds;
  amounts from `payload->'taxSummary'`/totals, items from `items`; `cashier_id = NULL`; day/hour from `created_at`.
- `fold/products.ts`: same docs, `jsonb_array_elements(items)` → product rows (invoice = sold, credit note = refunded);
  cost via the existing `unit_cost` lookup (refund cost at the doc's own day — note the limit in a `shortcut:` comment
  if it differs from the till rule).
- `fold/tenders.ts`: confirmed `order_payment` that settled an order (kind = `method`) and `order_refund` rows
  (refunded through the paying method).
- `fiscal/documents.ts` `recordFiscalDoc`: accept `items` and call `touchStoreDay` for order sources, so settle,
  adjust and compensate all mark the day stale in one place. Callers: `orders/payments/settle.ts`
  (items from order lines), `orders/fulfil/adjust.ts` (`goods.credits`, `goods.substitutes`),
  `orders/payments/refunds/compensate.ts` (`goods.kept + goods.substitutes`).
- `reports/sums.ts` `namesOf`/`label`: a null cashier labels "Online shop".

## S2 · Online orders in the transactions explorer

Tests first — extend `tests/integration/transactions/explorer.test.ts`: a paid order is listed (kind `order`, receipt
number, total, tender, status `completed`, then `refunded` after any `order_refund`), found by receipt number and by phone,
filtered by branch and tender, excluded by a cashier filter, scoped by branch permission, present in the CSV export.
E2e: `tests/e2e/portal/...transactions` — the order row shows "Online shop" and Enter opens the Day 34 order page.

Implementation: `packages/core/src/transactions/list.ts` `matching()` gains a third `UNION ALL` over `online_order`
(`paid_at` not null); `types.ts` adds `kind: "order"`, nullable `cashierId`. Back office list row
(`packages/backoffice/src/components/transactions/list/*`): "Online shop" in the cashier cell and the row links to
`/orders/$id` instead of the sale drill-down. No new detail screen (the order page already shows lines, picks, refunds).

## S3 · Shop order page shows what the shopper pays now

Test first — extend the Day 34 shop e2e: after a short pick, the totals block shows the adjusted gross and the lines
show picked/substituted quantities; no first-ordered total remains beside the change card.
Implementation: `readOrderView` (`packages/core/src/orders/view.ts`) returns `totals` from the adjustment's after-state;
`apps/shop/src/components/order/confirmation.tsx` renders them. Check `skeleton-audit` impact (none expected).

## S4 · Shop URL + signed review link

Tests first — `tests/integration/orders/reviews/link.test.ts`: the `review.ask` SMS contains
`{SHOPPER_SHOP_URL}/{code}/orders/{id}?r={token}`; that token opens the order view and accepts one review; a tampered,
expired (past `REVIEW_WINDOW_MS`) or other-order token gets 404; without `SHOPPER_SHOP_URL` the delivery retries.
Tenant sweep stays green (the route is already public; add the `r` body/query case in `tests/support/security`).

Implementation:

- Config `SHOPPER_SHOP_URL` (portal + edge `cloudflare.config.ts` bindings.text per stage, box env, `.dev.vars` example)
  → passed into `NotificationDeps` like `baseUrl`/`linkSecret`.
- `orders/reviews/link.ts`: `signReviewToken` / `verifyReviewToken` with `hmacHex`/`hmacVerify` from `@shopper/utils`,
  payload `{ orgId, orderId, exp }` (same shape as `customers/statements/links.ts`, no table needed: the order itself
  guards one review).
- `deliverReviewAsk` adds the link. `packages/api/src/routes/shop/orders.ts`: view + review routes accept `r` as an
  alternative to the checkout key. Shop route reads `r` from search params (TanStack Router `validateSearch`).

## S5 · Paystack MoMo code step online

Tests first — `tests/integration/orders/payments/otp.test.ts` with the Paystack fake: a charge answering `send_otp`
leaves the payment `otp` (not failed); `POST /shop/:code/orders/:id/pay/otp` with the checkout key and the code settles
the order; a wrong code fails the attempt and the shopper can retry; the hold deadline still applies. Shop e2e: code
field appears, keyboard-only entry pays.
Implementation: `packages/core/src/workflows/payments/order.ts` keeps `otp` and loops on `waitFor("payment")` like the
till's `workflows/payments/momo.ts` (reuse `paystack.submitOtp`); the API route sends the event; the shop pay panel
(`apps/shop/src/components/order/pay.tsx`) reuses `CodeSlots` from `components/signin`.

## Verification

- Per slice: the new tests fail before, pass after (break-check once each); `vp check`, `vp run guard`.
- Before push: `vp test --run` for `tests/integration/{reports,transactions,orders}` and the shop/portal e2e specs;
  `vp run build`; full suite left to CI.
- UI: `ui-verify` with `playwright-cli` on the explorer, shop order page and pay panel at all sizes; screenshots to
  `docs/plans/day35/screenshots`.
- Real flow in the dev stack (`vp run services:up`, `db:migrate`, `db:seed`): place, pay (fake Paystack), pick short,
  open the sales report and explorer and see the order; review link from the SMS log opens and submits.
- `codex review` on the branch; PR → CI green → squash-merge → Notion Day 35 updated with Progress and Remarks.

## Risks

- S1 changes the meaning of report totals (now include online). Rollup tables are refolded by wiping `report_*` and
  `store_day.rolled_at` (data disposable).
- If time runs out, S5 is the one to drop and carry to Day 37 catch-up; S1–S4 are the core.

## As built (differences from the plan)

- **S0/S1:** `recordFiscalDoc` writes nothing for a shop that is not VAT-registered, so fiscal documents could not be the
  report source. Instead a new table `order_report_line` (migration `0041_online_reports.sql`) holds one row per line or fee of each
  order document, with its tax snapshot, tender and day. Settle, adjust and compensate write it through
  `orders/report.ts`, which also marks the store day stale. `fiscal_doc` is unchanged.
- **S5:** the route is `POST /shop/:code/orders/:id/pay/code`. A wrong code keeps the attempt in `otp`, with the network's
  reason shown, so the shopper simply types again; the order's hold deadline still ends an attempt that never gets a code.
