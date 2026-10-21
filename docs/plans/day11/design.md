# Day 11 design contract

This contract is shared by slices S2–S7. Change it here first, then in code. Money is integer
4dp (1 GHS = 10000). Quantities are integer thousandths. IDs are UUIDv7. Every table carries `org_id`.

## Units

| Unit       | Value in money units |
| ---------- | -------------------- |
| 1 GHS      | 10000                |
| 1 pesewa   | 100                  |
| 10 pesewas | 1000                 |

The cash-rounding step is 1000. MoMo amounts must be whole pesewas (`amount % 100 === 0`); Paystack
is sent `toPesewas(amount)`.

## Settlement: `settle(gross, tenders, rounding)`

This lives in `packages/core/src/till/tenders/settle.ts`. It is pure and every operation goes
through `@shopper/money`.

- `gross` is the sum of line gross after line discounts (`totals.gross`).
- `tenders` is a list of `{ kind: "cash" | "momo" | "card", amount }`. For cash, `amount` is the cash
  received. For card and MoMo, `amount` is the value applied.
- `rounding` is `"none"` or `"10p"`. It is the org setting `cashRounding`, carried in the till
  reference snapshot.

The function works in this order:

1. `nonCash` is the sum of the card and MoMo tenders. If `nonCash > gross`, it throws
   `TillError("TENDER_OVERPAID")`, because card and MoMo never give change.
2. `remaining = gross - nonCash`.
3. If `rounding === "10p"` and either a cash tender exists or the cashier selected cash, then
   `due = roundCash(remaining, 1000)` (half-up) and `roundingLine = due - remaining`. The rounding
   line may be negative. Otherwise `due = remaining` and `roundingLine = 0`.
4. `cash` is the sum of the cash tenders, `balance = max(0, due - cash)` and
   `change = max(0, cash - due)`.
5. It returns `{ gross, roundingLine, total: gross + roundingLine, nonCash, cash, balance, change }`.

Completion requires `balance === 0`; pending or OTP MoMo attempts block completion. Only applied
cash/card and confirmed MoMo contribute to settled tenders. Failed/expired attempts remain payment
history and are excluded from the completed sale; a later confirmation remains recoverable.

## Till SQLite (fresh schema, `tillMigrations` collapsed to one step)

Changes to the existing tables:

- `sale_draft` drops the old `UNIQUE(org_id,device_id,branch_id,cashier_id)` and gains:
  - `status TEXT NOT NULL DEFAULT 'open'`, one of `open`, `held` or `voided`. A partial unique index
    allows one open draft per scope.
  - `name TEXT` for an optional hold label, plus `held_at TEXT`, `voided_at TEXT` and
    `void_reason TEXT`.
- `sale_draft_line` gains `discount INTEGER NOT NULL DEFAULT 0`. This is money off the line's gross,
  inclusive.

New tables:

- The local `stock_movement` mirror has `id`, `org_id`, `device_id`, `branch_id`, `product_id`,
  `sale_id`, `sale_line_id`, signed `quantity_thousandths`, `reason` (`sale`) and `occurred_at`.
  `sale.complete` inserts one negative movement per completed line in the same SQLite transaction
  as the sale, receipt, outbox and audit. `(org_id, sale_line_id)` is unique.
- `sale_draft_tender` has `id`, `org_id`, `draft_id`, `position`, `kind`, `amount`, `reference`
  (the MoMo payment reference), `approval_code`, `last4`, `phone` (MoMo, stored masked), `network`,
  `status` (`applied | pending | otp | confirmed | failed | expired`) and `created_at`. Cash and card
  are `applied` immediately. The table has `UNIQUE(draft_id, position)`.
- `local_sale` gains `status TEXT NOT NULL DEFAULT 'completed'` and `receipt TEXT`, which holds the
  receipt document JSON. `sale_line` is unchanged.

## Sale event v3 (`sale.recorded`, v3 only, no upcasters)

The v3 snapshot is the v2 snapshot plus the following:

- Each line has `discount` (also in `tax.discount`) and
  `label: null | { kind: "weight"; code: string } | { kind: "price"; code: string; originalPriceId: string }`.
  Price labels retain the immutable price version selected at scan time. Ingest derives their original
  quantity from that version's amount, so later repricing preserves encoded gross and quantity edits.
- `cashRounding: Money` (signed) and `total: Money`, where `total = totals.gross + cashRounding`.
- `tenders` is an array with at least one entry, each `{ id, kind, amount, reference?,
  approvalCode?, last4?, network? }`. MoMo tenders carry `reference`. Card tenders carry
  `approvalCode`, which is 4–12 alphanumeric characters.
- `change: Money` and `paid: Money`, where `paid` is the sum of the tender amounts and
  `paid - change === total`.

The receipt document is not in the event. Each side builds it with `buildReceipt` (S4).

Version bumps: `buildInfo.syncProtocol` increases by one, and the API `saleVersion` becomes
`v.picklist([3])`. Delete `tests/fixtures/sales/v1.json` and `tests/fixtures/sales/v2.json`.

## PostgreSQL (`0015_tenders.sql`)

Changes to `sale`:

- New columns: `status text not null default 'completed'`, `total bigint`,
  `cash_rounding bigint not null default 0`, `paid bigint`, `change bigint not null default 0`
  and `receipt jsonb`.

New tables:

- `sale_tender` has `id`, `org_id`, `sale_id` (FK), `position`, `kind`, `amount`, `reference`,
  `approval_code`, `last4`, `network` and `payment_id` (nullable FK to `payment`).
  - `unique(org_id, payment_id)` stops a confirmed MoMo payment being used twice.
- `stock_movement` has `id`, `org_id`, `branch_id`, `product_id`, `sale_id` (nullable),
  `sale_line_id`, `quantity_thousandths` (signed; a sale is negative), `reason`
  (`sale | adjustment | return`) and `occurred_at`.
- `payment` is a MoMo intent with these columns:
  - `id`, `org_id`, `branch_id`, `device_id`, `cashier_id`;
  - `reference`, unique per org, which is also the workflow instance ID;
  - `amount`, `phone` (stored masked) and `network` (`mtn | telecel | airteltigo`, mapped to
    Paystack `mtn | vod | atl`);
  - `status` (`pending | otp | confirmed | failed | expired`), `provider_reference`,
    `failure_reason`, `created_at` and `updated_at`.

Ingest (`sale.accept`) inserts the sale, its lines, tenders and stock movements and stores the
receipt document. It writes one audit row in the same transaction.

## Permissions (data)

The new permissions are `sale.discount`, `sale.void` and `payment.momo`. The seeded roles are
`superadmin` (the owner) and `admin` (the manager), and both get all three. The cashier role gets
`payment.momo` only. All three are till-allowed. The till checks them
through `checkSession`, and the server re-checks discounts against the cashier's role.

## Org setting `cashRounding`

`org.cash_rounding` (`none | 10p`, default `10p`) is read by `buildSnapshot` into
`reference.cashRounding` of the v2 snapshot (optional on the wire, default `10p`, so cached snapshots
still decode). The till stores it as one `reference` row (`entity = 'org-setting'`, id = org id) and
`readQuoteReference` returns it as `cashRounding`. The change feed does not carry it, so a changed
setting reaches tills with their next snapshot.

## Till commands (SQLite `defineCommand`, each audited)

| Command                                        | Permission      | Notes                                                                                                                                                                    |
| ---------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `till.draft.discount`                          | `sale.discount` | Sets `sale_draft_line.discount`, where `0 ≤ discount ≤ line gross`.                                                                                                      |
| `till.draft.tender.add`                        | `sale.create`   | Cash, or card with an approval code. MoMo goes through `payment.momo.start`.                                                                                             |
| `till.draft.tender.remove`                     | `sale.create`   | Refused for `confirmed` MoMo.                                                                                                                                            |
| `till.draft.hold`                              | `sale.create`   | `open` → `held`. Refused while MoMo is pending or confirmed.                                                                                                             |
| `till.draft.resume`                            | `sale.create`   | `held` → `open`. Refused if another open draft has lines.                                                                                                                |
| `till.draft.void`                              | `sale.void`     | Needs a reason. Refused if any MoMo is confirmed. Keeps the row as `voided`.                                                                                             |
| `sale.complete` (replaces `sale.record-local`) | `sale.create`   | One transaction: requote, settle, check `balance = 0`, assign receipt, build receipt, then write `local_sale`, lines, outbox v3 and the audit row, and delete the draft. |

Bridge ops reach the browser through `browserRequests` and all take `expectedRevision`:
`tender.add`, `tender.remove`, `discount.set`, `sale.complete`, `sale.hold`, `sale.resume`,
`sale.listHeld`, `sale.void`, `payment.momo.start`, `payment.momo.otp`, `sales.list` and
`sales.read`.

## MoMo flow

1. The till UI sends `payment.momo.start` with `{ phone, network, amount }`. The till host calls
   `POST /payments/momo` over its device-authenticated HTTP client, then stores a `pending` draft
   tender with the reference.
2. The API creates the `payment` row and launches `MomoPaymentWorkflow` with
   `id = reference`. The workflow charges Paystack. On `send_otp` it sets the status to `otp`.
3. The UI sends `payment.momo.otp`. The host calls `POST /payments/momo/:ref/otp`, which sends the
   workflow the `otp` event. The workflow then calls Paystack `submit_otp`.
4. Paystack calls `POST /webhooks/paystack`, which checks the HMAC-SHA512 signature. A
   `charge.success` or `charge.failed` event is sent to the workflow. If no webhook arrives before
   the timeout (3 min), the workflow calls `verify` once.
5. The workflow marks the payment `confirmed`, `failed` or `expired`, writes an audit row and
   updates `workflow_run`. It then publishes realtime `{ type: "payment.updated", reference,
   status }` to the store's StoreHub.
6. The till host updates the draft tender status and pushes a `draft` message to the UI.
7. Server ingest rejects a MoMo tender unless its payment is `confirmed`, its amount is equal, it
   belongs to the same org and branch, and it has not been used before.

## Implementation clarifications (15 October 2026)

- Fully discounted and cash-rounded zero-total baskets complete with a zero cash tender; zero card
  and MoMo tenders remain invalid. A zero tender is refused for a nonzero sale. Forward migration
  `0016_zero_cash` updates the PostgreSQL tender constraint.
- The SQLite `payment_intent` mirror retains masked payment outcomes independently of an active
  draft. A late confirmation after removal/void remains an unresolved Purchases entry. Confirmed
  references already present in a completed local sale cannot settle another local sale.
- Pending/OTP MoMo reserves its amount: basket quantity/removal/discount edits cannot reduce the
  gross below reserved noncash payments. A reference-price change that makes confirmed tenders
  exceed gross yields `settlementError` in the readable draft and blocks completion; confirmation
  is still durable and cannot be removed or voided.
- Charge references are reserved locally before HTTP and accepted idempotently by the API. A
  failed/uncertain HTTP response retains the same reference for retry/reconnect recovery.

- MoMo commits the audited payment intent and waiting `workflow_run` before starting the engine.
  This deliberately differs from sleeping workflows: an immediate provider charge must never run
  against an uncommitted intent. Launch failure returns 503 while retaining the intent; retrying
  the locally reserved UUID repeats launch with the same business key and provider reference.
  Recovery lists unresolved intents, including confirmed money whose draft was removed or voided.
  PostgreSQL `payment.id` equals this reference, so another tenant cannot reserve the same key.
- Exhausted provider charge errors and verification exceptions expire uncertain MoMo payments,
  persist a failed `workflow_run` and publish the terminal payment state. They never imply a
  provider decline or overwrite confirmed money. A later signed success can still confirm expiry.
