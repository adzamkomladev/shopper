# Day 33 · Online payments

> Status: plan, not started. Branch `day33-online-payments` off `main` (d2cc0fc). Data is disposable: migrations may add
> NOT NULL columns without a backfill, and local Postgres, D1, KV and Durable Object state may be wiped at any point.

## Context

Notion row **33 · Online payments** (Phase 5, P0, surfaces Shop + API + Tax):

- Online payments through the Payment Workflow (30-minute wait online); Hubtel as a second provider behind the same
  steps; refunds as compensation steps.
- Paystack checkout (card + MoMo); Hubtel USSD for feature phones.
- Webhooks, payment failure and retry, refunds.
- Confirmation SMS and email.
- Online orders fiscalised through the same E-VAT path.

Tests: **paid order → fiscal doc → confirmation queued**; **failed payment releases the reservation after the
timeout**. **Done when money arrives and the order is legally invoiced.**

## What Day 32 left us (read, not guessed)

| Piece                                                                                                                                             | Where                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Order workflow: `held` → wait `payment.settled` until the hold ends → `expired` or `paid` → wait `store.accepted` (a day) → `accepted`            | `packages/core/src/workflows/order.ts`, `orders/flow.ts`                 |
| Order placed unpaid, 30-minute hold (`HOLD_MINUTES`), `online_order` + lines with tax snapshot, shop order view by checkout key                   | `orders/place.ts`, `GET/POST /shop/:code/orders`                         |
| Till MoMo payment workflow (charge → wait → verify once), Paystack + Hubtel clients, signed webhook route with per-event dedupe (`payment_event`) | `workflows/payments/momo.ts`, `payments/*`, `api/src/payments/routes.ts` |
| MoMo refund workflow (one attempt, webhook ends the wait, verify once)                                                                            | `workflows/payments/refund.ts`                                           |
| Paystack hosted checkout (`initializeCheckout`) used only by billing invoices; no subaccount, no callback                                         | `payments/paystack/checkout.ts`                                          |
| `payoutSubaccount(db, orgId)`: where a shop's money lands                                                                                         | `kyb/records`                                                            |
| Fiscal documents for a sale or refund, submitted later by the fiscal lane                                                                         | `fiscal/documents.ts` (`recordFiscalDoc`), `fiscal/submit.ts`            |
| Ledger `postSale` (tender accounts incl. `momo_clearing`, `card_clearing`), `postEntry` is the only way to write ledger rows                      | `ledger/sales.ts`, `ledger/post.ts`                                      |
| Render-once receipt PDF (`renderSaleReceipt`, Browser Run / Satori) was built for Day 33 to call                                                  | `packages/assets/src/rendered.ts`                                        |
| Notification queue + one consumer with a `switch` per message type; Arkesel SMS; receipt email queue                                              | `notifications/deliver.ts`, `sms/`, `receipts/email/`                    |

## Gaps this day closes

1. The `payment` table is a till record (`device_id`, `cashier_id` NOT NULL, MoMo-only). Online payments need their own record.
2. Nothing starts a payment for an order or sends `payment.settled`.
3. `initializeCheckout` cannot split to the shop's subaccount or return the shopper to the order page. Without the
   subaccount the money would land with the platform, not the shop.
4. Payment confirmation does not make an invoice, a journal entry, a receipt or a notification.
5. A late or duplicate payment (after the hold lapsed) has nowhere to go but a refund. The order workflow has no refund step.
6. The shop confirmation page says "Awaiting payment" and offers no way to pay.

## Decisions (flagged where they are yours)

- **D1 · A paid order becomes a real `sale` row** (recommended; confirm). A synthetic "online" device and cashier
  session per branch own it. Then receipts, loyalty, customer history, transactions explorer, the shop's "your
  receipts" list, VAT reports, the fiscal lane and till refunds work unchanged. The alternative (order-native fiscal
  docs and journal source) touches `fiscal_doc`, `journal_source`, asset linking and every `sale` reader. **S0 reads
  `acceptSale` and decides the seam in 30 minutes; if a `sale` cannot be written without a till, fall back to
  order-native and tell you before building it.**
- **D2 · New `order_payment` table** (reference = id = payment workflow instance id), not a loosened `payment`. Several
  attempts per order are allowed; a partial unique index keeps one open attempt at a time.
- **D3 · "Hubtel USSD"** = Hubtel Receive Money through the existing client: the payer approves on their phone with
  *170# / the prompt, no smartphone or data needed. It runs through the same workflow steps as Paystack MoMo.
- **D4 · Optional email at checkout** (new field; Paystack needs an address, and the receipt email needs one). With
  none, Paystack gets `<phone>@pay.shopper.invalid`-style placeholder and no email is sent. Needs your yes.
- **D5 · Hubtel has no refund API in our client.** Refunding a Hubtel payment records `refund_due` and notifies the
  store; Paystack payments are refunded automatically. Stated limit, not hidden.
- **D6 · No Figma frame exists for online payment.** Compose it on the Day 30–32 shop theme from the frames you
  listed. The Figma MCP hit its plan limit again at the start of this planning, so values come from the frames read
  on Days 30–32; S9 retries `get_design_context` and records any drift.

## Data · migration `0039_order_payments.sql` + Drizzle

Schemas in `packages/db/pg/src/schemas/orders/payments.ts`.

- **`order_payment`**: org_id, id (UUIDv7 = reference), `order_id` FK, `provider` (`paystack|hubtel`), `method`
  (`card|momo`), `network` (nullable), `phone`, `amount` (= order gross, copied server-side), `status`
  (`pending|confirmed|failed|expired`), `provider_reference`, `checkout_url`, `failure_reason`, `confirmed_at`. Partial unique
  `(org_id, order_id) WHERE status = 'pending'`. Check: amount > 0 and a whole number of pesewas.
- **`order_refund`**: org_id, id, `order_payment_id`, amount, reason (`late_payment|not_accepted|cancelled|duplicate`),
  status (`pending|processed|failed|refund_due`), provider_reference, failure_reason.
- **`online_order`** additions: `email`, `sale_id` (nullable FK, set when paid), `paid_at`; status gains `refunded`.
- Reuse `payment_event` for webhook dedupe (key per provider event). Add both tables to the schema inventory and the
  tenant sweep table list.

## Slices (tests first, one commit each, `vp check` + `vp run guard` + `vp test --run` before each)

| #   | Slice                                 | Tests written first (`tests/integration/…`)                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S0  | Spike: the sale seam (no commit)      | Read `sales/accept.ts`, `authority.ts`, `till/complete.ts`; decide D1; write the decision at the top of this file.                                                                                                                                                                                                                                                                                                       |
| S1  | Data                                  | `schema/inventory.test.ts` and the tenant sweep list include the new tables; constraint tests (second open attempt refused, amount must match whole pesewas).                                                                                                                                                                                                                                                            |
| S2  | Paystack checkout for orders          | `payments/orders/checkout.test.ts`: initialize carries the shop's subaccount, the order reference, a callback to `/<shop>/orders/<id>?t=…`, card + MoMo channels, amount from the order, never from the request; a Paystack failure is a clean 502 with no row left.                                                                                                                                                     |
| S3  | Pay command, route, child workflow    | `payments/orders/pay.test.ts`: `POST /shop/:code/orders/:id/pay` needs the checkout key; a paid/expired order refuses; a repeated pay returns the open attempt; webhook `charge.success` for an order reference confirms once and sends `payment.settled`; replay is a no-op; wrong signature 401; amount mismatch 400. Payment workflow (cf + box twin): init → wait up to the remaining hold → on timeout verify once. |
| S4  | Settlement transaction (the key test) | `payments/orders/settle.test.ts`: **paid order → one `sale`, one pending `fiscal_doc` carrying the order's tax snapshot, one balanced journal entry (card/momo clearing vs sales and levies), receipt JSON, an audit row, a `order.confirmation` message queued**, all in one transaction; a replayed `markOrderPaid` makes none of them twice; the fiscal lane submits it and signs it.                                 |
| S5  | Failure, retry, timeout               | `payments/orders/failure.test.ts`: failed attempt keeps the hold and allows a second attempt; **no payment until the hold ends → order `expired`, reservation released, stock back on the store**; a payment confirmed after expiry never becomes a paid order and goes to refund.                                                                                                                                       |
| S6  | Hubtel behind the same steps          | `payments/orders/hubtel.test.ts`: charge → prompt pending → Hubtel callback confirms; amount collected ≠ order → failed; verify-on-timeout; no Hubtel setup → clear failure message (reuse the till's fakes).                                                                                                                                                                                                            |
| S7  | Refunds as compensation steps         | `payments/orders/refund.test.ts`: late payment, duplicate payment and an unaccepted paid order each refund the full amount once (one Paystack call, even on redelivery); the order ends `refunded`, stock released, ledger reversed (a balanced reversing entry), credit note queued for fiscal when an invoice exists; Hubtel → `refund_due` + store notice.                                                            |
| S8  | Confirmation SMS and email            | `payments/orders/notify.test.ts`: `order.confirmation` sends one SMS (number, slot, pickup/delivery) and, with an email, the receipt email with the render-once PDF link; redelivery sends nothing twice; no SMS credentials → retry then dead-letter; phone is masked in audit.                                                                                                                                         |
| S9  | Shop UI + e2e                         | `tests/e2e/shop/pay.spec.ts` (see UI). Playwright fakes for Paystack checkout and Hubtel in `tests/support/shop/`.                                                                                                                                                                                                                                                                                                       |
| S10 | Docs, verification, review            | `docs/plans/day33/verification.md`; `platforms.md` (order payment workflow, bindings), `security.md` (pay route, webhook routing), `frontend.md` (shop pay step). Codex review (`gpt-6.1-sol`) run from Bash, fixes with tests.                                                                                                                                                                                          |

### Wiring each slice touches (cloud and box parity)

- `packages/api`: `orderPayments?: WorkflowLauncher` in `ApiOptions`/`ShopOptions`; the Paystack webhook tries the
  till `payment` reference first, then `order_payment`; add a Hubtel callback branch the same way. A new `pay`
  rate-limit policy beside `checkout`.
- `packages/adapters/cf`: `OnlinePaymentWorkflow` class + binding in `apps/edge/cloudflare.config.ts`.
  `packages/adapters/box`: `boxOrderPayments` in-memory twin, same shortcut note as `boxOnlineOrders`.
  No port changes, so no conformance change; the integration suite runs the workflow function against both launchers.
- Order workflow gets the compensation steps (late payment, not accepted in time) and still never imports a binding.
- Security tests: new write body in `tests/support/security/bodies.ts`; the pay route is public on purpose in the sweep
  `PUBLIC` list (authority is the order's checkout key). Money events post through `postEntry` only.

## UI (apps/shop) · `/ui-screen` → `/ui-verify` → `/skeleton-audit`

The confirmation page gains a pay panel under the status card (stacked on mobile, right column on desktop).

- **Choose**: Card or Mobile money. Card → "Pay GHS x" opens Paystack. MoMo → network + phone (prefilled from the order)
  and, for feature phones, "Pay with a prompt on my phone" (Hubtel). `P` focuses pay; Enter submits; Esc leaves the sheet.
- **Waiting**: "Approve on your phone" with a countdown to the hold end; the page refetches the order on an interval
  (TanStack Query, no effects) and moves itself when the status changes.
- **Returning from Paystack**: `?t=` and the order id read the order back; shows "Checking your payment" until the webhook lands.
- **Paid**: receipt link (PDF via the render-once grant), order number, slot.
- **Failed / expired / refunded**: reason, "Try again" (while the hold lasts) or a plain "this order lapsed".
- Checkout form gains the optional email field. Design every state and its skeleton; keyboard path and the five
  viewport sizes with `playwright-cli`; screenshots in `docs/plans/day33/screenshots/`.
- Figma: Web Flow 227:4900 (Checkout frame), New Login 173:3087 (field/error states), Componets 12:66 (tokens),
  Dashboard 27:2031 (form layout), Barcode Scanner 45:852 (empty states), 12:66 again.

## How I will work (your instructions)

- **No subagents.** Everything inline on this model; skills and CLIs used directly: `tdd-slice` per slice,
  `cloud-box-parity` + `durable-objects`/`workers-best-practices` skills for the workflows and wiring, `ui-screen`,
  `ui-verify`, `skeleton-audit` with `playwright-cli`, `pre-merge-review` via `codex review` from Bash, `cf` CLI (never wrangler).
- Write the tests first and make them meaningful (each proven by a deliberate break), then implement, then run the full
  suite and fix what comes up. Heavy-load timeouts that pass alone are noted, not hidden.
- **Commit after every green slice. Push only when all slices are done.** No AI attribution anywhere.
- Reset freely: `vp run services:down` with volumes, `vp run db:migrate`, `vp run db:seed`; D1/KV/DO state is wiped by
  recreating the local runtime. Nothing is deployed on Day 33.

## Ship

1. `vp check`, `vp run guard`, `vp test --run`, `vp run build`, Playwright projects green.
2. Push `day33-online-payments`, open the PR, bind it with `ccd_pr`, turn on Auto-fix.
3. Watch CI to green (the desktop app wakes me on failures; I fix, push, repeat). Merge when green. Fast-forward local `main`.
4. Update the Notion **33 · Online payments** row: tick tasks and tests, Status = Done, add Progress and Remarks in the Day 32 format (PR link, migration, what was built, Codex findings, CI notes, known limits, next).

## Known limits to carry into the remarks

- Hubtel refunds are manual (D5). Box payment waits are in-process until Rivet (Day 36).
- Live Paystack/Hubtel calls are covered by fakes; the existing `paystack/live.test.ts` runs only with keys.
- A paid order the store never accepts refunds after the existing one-day accept window.
