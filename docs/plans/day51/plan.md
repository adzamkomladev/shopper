# Day 51 — v1.5 · 6 · Customers, receipts, loyalty

## Context

Notion row "v1.5 · 6 · Customers, receipts, loyalty" (Box, Shop, P0).

- Customer accounts live in the relay org (phone OTP).
- The box receives name, phone and address with each order and links them to the in-store loyalty record by phone.
- For opted-in customers only, the box publishes their digital receipts and loyalty balance.
- Fiscalisation happens on the box at fulfilment; completed orders are purged from the cloud after the purge period.

Tests from the row: an opted-out customer's receipts never leave the box; the loyalty balance in the webapp equals
the box ledger. **Done when:** the customer webapp works the same for on-prem and cloud shops.

Working rules (user, memory): no subagents; tests first; one commit per slice; push once at the end; PR, watch CI
until green (fix and push if red), merge; update Notion. Data is disposable. Review model is now Codex `gpt-6.2-sol`.

## What exists (traced)

| Need                         | Today                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Shopper sign-in              | `shop/signin.ts` phone OTP → `shop_account` in the shop's org; relay orgs are normal orgs (`org.mode`)         |
| Shopper receipts             | `shop/purchases.ts`: `sale` rows whose customer is one of `customersOf(session)` (live rows by phone + merged) |
| Shopper points               | `shop/points.ts` `readShopPoints`: `loyalty_entry` fold over the same rows, tier, newest 50 entries            |
| Receipt PDF                  | `/shop/account/receipts/:id/pdf` → grant on the till's verified PDF; the page renders the JSON without one     |
| Order customer on the box    | Day 50 `receiveOrders` mirrors `customer_name`, `customer_phone`, `delivery_address`; no customer link         |
| Online order fiscal document | `settleOrder` (relay, at payment) → `recordFiscalDoc`; the box's hand-over of a relayed order records none     |
| Box → relay loop             | Publisher run (`publishPending`, 246 lines): take orders → publish catalogue → tell orders → heartbeat         |
| Opt-in                       | Nothing: `customer` has no sharing flag                                                                        |
| Relay purge                  | Not built; the v1.5 plan puts the purge job on Day 53 ("Data residency & ops")                                 |

The relay's `sale` and `loyalty_entry` tables cannot take the box's rows: a sale needs the relay's device, cashier,
session, prices and tax rules, and the relay's reports and ledger read `sale`. So the relay keeps a read-only copy of
what the webapp shows, in two relay-only tables.

## Decisions

1. **Opt-in is a box customer flag set by staff.** `customer.online_shared_at` (null = not shared), set by a new
   audited command `customer.online.set { id, on }` under the existing customer-edit permission. Not part of
   `fieldsOf` or `customerUpsert`, so tills and sale-event versions are unchanged. A phone counts as opted in when any
   live row with that phone is.
2. **The box publishes exactly what the webapp shows, computed by the webapp's own code.** For each opted-in phone the
   box runs `readShopPoints` and the receipt list query (`shop/purchases.ts`, newest 100, with their receipt
   documents) against its own database. One code path, so "webapp balance = box ledger" holds by construction and the
   test proves it end to end.
3. **New relay endpoint, own allowlisted batch.** `POST /relay/customers` takes
   `{ customers: [{ id, phone, name, points, receipts }], withdrawn: [id] }` (strict Valibot objects, at most 25
   customers per batch). `id` is the box's live customer row for that phone. The relay replaces the customer's
   points and receipts in one audited command (`relay.customers.published`). Withdrawn ids lose both.
4. **Hash and resend only changes.** `relay_published` gains entity `customer` (hash of the published object). A
   customer published before and no longer opted in (or merged or archived) is sent as withdrawn once. Runs after the
   catalogue publish, before telling orders. The step lives in `relay/customers/box.ts`; `publisher.ts` gets one call.
5. **Relay tables** (relay orgs only, written only by the relay route): `relay_customer (org_id, id, phone, points
   jsonb, published_at)` and `relay_receipt (org_id, id = box sale id, customer_id, receipt_number, occurred_at,
   total, status, branch_name, receipt jsonb)`.
6. **The webapp reads the copy on a relay org.** `listShopReceipts`, `readShopReceipt` and `readShopPoints` check
   `org.mode`; on `relay` they read `relay_receipt` / `relay_customer` by the session phone. Relay receipts have
   `pdf: false` (the till PDFs stay on the box; the page already renders the JSON receipt).
   `shortcut: no PDF copies for relay receipts; upload them like photos if a shop asks.`
7. **Link orders to in-store loyalty by phone.** `receiveOrders` resolves the box customer for each order's phone
   (oldest live row, else creates one with the order's name, published to tills) and stores it in a new
   `online_order.customer_id`. The staff order shows the linked customer. Points are not earned on online orders
   (cloud orders do not earn either).
8. **Fiscalise relayed orders on the box at hand-over.** `settleOrder` skips `recordFiscalDoc` when the org is a
   relay; the box's hand-over of a relayed order records the pending fiscal document from the mirrored receipt (same
   invoice number), and the box's fiscal lane signs it over its E-VAT link as it does every sale.
9. **Purge stays on Day 53**, where the v1.5 schedule puts it ("Purge job for completed orders in the relay"). The
   Day 51 Notion remarks say so.

## Behaviours as tests (written first, each seen failing)

`tests/integration/relay/customers.test.ts` (new; reuses `inboxWorld` from `tests/support/relay/inbox.ts`: a relay
org with a box database mirroring it; box sales and loyalty written with the golden sale fixture helpers):

1. **An opted-out customer's receipts never leave the box.** Box customer with sales and points, not opted in; a
   run; no `/relay/customers` request carries their phone or receipt numbers, and the relay tables are empty for them.
   Opting in then out sends a withdrawal and the relay copy is gone.
2. **Loyalty balance in the webapp equals the box ledger.** Opt in; run; sign in on the relay org with phone OTP
   (accounts live in the relay org); `GET /shop/account/points` equals the box's `readShopPoints` (balance, tier,
   entries) and the sum of the box's `loyalty_entry` rows. Earn more on the box; next run; the webapp follows.
3. **Receipts show the same.** `GET /shop/account/receipts` and `/:id` on the relay return the box's receipts
   (number, total, branch, document), `pdf: false`; another shopper's receipt id is 404.
4. **A batch outside the allowlist is refused.** An extra field (e.g. `creditLimit`) in a published customer is a 400
   and nothing is stored.
5. **An order links to in-store loyalty by phone.** A relayed order whose phone matches a box customer gets that
   `customer_id`; an unknown phone creates one customer with the order's name (once, even when redelivered).
6. **Fiscalised on the box at fulfilment.** A relayed order: no `fiscal_doc` on the relay after payment; after the
   box's pick and hand-over, one pending `fiscal_doc` on the box with the order's receipt number.

Existing tests to update: relay `publisher.test.ts` / `heartbeat.test.ts` if they count requests per run; tax schema
table counts (`tests/integration/tax/schema/tax.test.ts`) for the two new tables; `customers/records.test.ts` if it
snapshots columns; the tenant sweep body for `PATCH /customers/:id/online` and the sweep's relay `PUBLIC` list for
`/relay/customers`.

E2E `tests/e2e/portal/customers` (detail): the "Share receipts and points online" switch toggles and persists.

## Changes

- **`@shopper/db-pg`**: `customer.online_shared_at`; `online_order.customer_id` (FK to customer); `relay_customer`,
  `relay_receipt`; `relay_published.entity` + `customer`; migration `0052_relay_customers.sql` (forward-only,
  idempotent).
- **`@shopper/core`**:
  - `customers/online.ts`: `setCustomerOnline` command.
  - `schemas/relay/customers.ts` (or beside `schemas/relay.ts`): `relayCustomers` strict batch.
  - `relay/customers/box.ts`: `shareCustomers` (opted-in phones → points + receipts, hash, batch, withdraw).
  - `relay/customers/relay.ts`: `publishRelayCustomers` command; reads for the shop.
  - `shop/{points,purchases}.ts`: read the relay copy on relay orgs.
  - `relay/inbox/box.ts`: link the customer by phone on receive.
  - `orders/payments/settle.ts`: no fiscal document on relay orgs; `orders/fulfil/handover.ts`: record it on the box.
- **`@shopper/api`**: `POST /relay/customers`; `PATCH /customers/:id/online`.
- **`@shopper/backoffice`**: customer detail switch (`components/customers/detail/online.tsx`), shown when the shop's
  Online Orders is on; `CustomerView.onlineShared`; mutation in `queries/customers/`.

## UI

- Customer detail → details card: a row "Online receipts and points" with a `Switch` and a one-line hint ("Their
  receipts and points show in your online store's account page."). Shown only when Online Orders is on. Saving state
  disables the switch; failure shows the existing toast. Keyboard: Tab to it, Space toggles.
- Figma: the supplied file's pages are New Login, Research, Web Flow (till checkout and dashboard), Components, Login,
  Dashboard and Barcode Scanner. None has a customer profile or shop account frame; follow the Components page
  (Switch, tokens) and the existing customer detail screen.
- `/ui-verify` with playwright-cli at desktop, laptop, tablet, mobile, till; console; overflow. The shop account page
  is unchanged (same JSON, `pdf: false` already handled) and is checked once on a relay org.

## Rules at risk

- **Privacy:** an allowlist batch; only opted-in phones; no credit, TIN, KYC or notes leave the box. Test 1 and 4.
- **Audit:** opt-in, relay customer publish, order-customer link are `defineCommand`s.
- **Tenancy:** relay endpoints act on the licence's org only; shop reads filter `org_id` and the session phone.
- **Money:** amounts are copied as integers; no arithmetic.
- **No new DO/actor, no cron:** the step rides the Publisher run.
- **Size:** `publisher.ts` is at 246 of 250 lines; new code in `relay/customers/`.

## Slices (commit after each)

- **S0 Agent files.** Codex review model `gpt-6.1-sol` → `gpt-6.2-sol` across `AGENTS.md`, `CLAUDE.md`,
  `.agents/`, `.claude/agents/`, `.codex/`, `.opencode/`, `opencode.json`, `docs/engineering/ai-workflow.md`.
- **S1 Opt-in and publish.** Migration, schema, opt-in command + route, relay endpoint and tables, box step; tests 1
  and 4.
- **S2 Webapp on relay orgs.** Shop reads on relay; tests 2 and 3.
- **S3 Orders link to customers; fiscal on the box.** Tests 5 and 6.
- **S4 Customer detail switch.** Backoffice UI, e2e, `/ui-verify`.
- **S5 Docs, review, ship.** `platforms.md` relay section, owner guide (customers), `verification.md`; `vp check`,
  `vp run guard`, `vp test --run`; `/pre-merge-review` (Codex `gpt-6.2-sol`); push, PR, CI green, merge; Notion row.

## Not in scope

- Purge of completed relay orders (Day 53, with the "What leaves your building" page).
- Earning points on online orders (cloud orders do not earn either).
- Shopper-side opt-in from the webapp; staff record consent on the box.
- Receipt PDFs on the relay (JSON receipt only).
