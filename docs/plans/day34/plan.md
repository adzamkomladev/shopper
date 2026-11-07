# Day 34 · Fulfilment

> Status: plan, not started. Branch `day34-fulfilment` off `main` (86674eb). Data is disposable: migrations may add NOT NULL
> columns without a backfill, and local Postgres, D1, KV and Durable Object state may be wiped at any point.

## Context

Notion row **34 · Fulfilment** (Phase 5, P0, surfaces Till + Shop). Milestone: **first online order paid, picked and handed over.**

Tasks:

- Finish the Online order Workflow: wait `store_accepted` (10 min, else refund) → `sleepUntil` slot − 1 h → notify pickers → wait `picked` → wait `handed_over`.
- Review Workflow: sleep 48 h → ask → wait `review_submitted` 7 d → moderation → wait `moderator_decision` if flagged → publish; `review` table.
- Order queue per branch in the till; picking-list screen.
- Substitutions and partial fulfilment (price/tax adjustment and partial refund).
- Status pushed to the customer: ready for pickup / out for delivery / delivered.
- Reservation released on cancel.

Test: **order → pick → substitute → fulfil → stock, money and fiscal docs all consistent.**
Done when: **first online order paid, picked and handed over.**

## What Day 33 left us (read, not guessed)

| Piece                                                                                                                                                              | Where                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `runOnlineOrder`: held → wait `payment.settled` → paid → wait `store.accepted` (**a day**, `acceptWithinMs`) → `accepted`, else `refundPaidOrder` (`not_accepted`) | `packages/core/src/workflows/order.ts`                               |
| Order commands (`confirmHeld`, `expireOrder`, `markOrderPaid`, `acceptOrder`), `status` moves with a `from → to` guard                                             | `packages/core/src/orders/flow.ts`                                   |
| `settleOrder`: one transaction pays, builds the receipt, records the fiscal invoice, moves stock out, releases holds, posts the books, queues the SMS              | `orders/payments/settle.ts`                                          |
| `refundPaidOrder`: only from `paid`; full refund, goods back, `reverseOrder` mirrors the whole entry, credit note for the whole receipt                            | `orders/payments/refunds/compensate.ts`, `ledger/orders.ts`          |
| `owe()` + `refundOrderPayment`: an owed refund row, Paystack called once; Hubtel → `refund_due`                                                                    | `orders/payments/apply.ts`, `refunds/send.ts`                        |
| `online_order` (status enum `placed expired cancelled paid accepted refunded`), lines with a tax snapshot in `payload`, `stock_hold`                               | `packages/db/pg/src/schemas/orders/*`                                |
| `recordFiscalDoc` (sources: sale, refund, order, order refund); `postEntry` is the only way to write ledger rows                                                   | `fiscal/documents.ts`, `ledger/post.ts`                              |
| Notification queue, one consumer with a `switch` per type; `order.confirmation`, `order.refund` handlers                                                           | `notifications/deliver.ts`                                           |
| Shop order page (status card, pay panel), `PlacedOrder` schema                                                                                                     | `apps/shop/src/components/order/*`                                   |
| Till shell tabs; the register already links to the full back office at `/backoffice/` (same-origin `/api`, host proxies upstream)                                  | `apps/till/ui/src/components/shell/*`, `apps/till/ui/src/backoffice` |
| Back office nav items, permission-gated, runs in portal, box SPA and the register                                                                                  | `packages/backoffice/src/lib/shell/nav/items.ts`                     |
| Workflow port with `sleepUntil` and `waitFor` (returns the event payload); CF + box (`memoryWorkflow`) twins                                                       | `packages/ports`, `adapters/cf/src/workflows/flow.ts`                |

## Gaps this day closes

1. Nothing lets the store see, accept, decline, pick or hand over an order. `store.accepted` is never sent by anyone.
2. After `accepted` the workflow ends. No slot timing, no pick, no hand-over, no customer status, no review.
3. A paid order's goods leave stock at payment. A short pick or a substitute has no way to correct stock, books, invoice or the money.
4. `refundPaidOrder` only works from `paid` and refunds in full. It cannot cancel an accepted or picked order, or refund a part.
5. Cancel exists nowhere: a shopper cannot release an unpaid order's reservation early.
6. No `review` table, workflow or moderation.

## Decisions (flagged where they are yours; I proceed on the defaults)

- **D1 · The order queue and picking list live in `@shopper/backoffice`, reached from the till.** Online orders live in the
  cloud database and need the internet anyway, so a till-native screen would mean a new sync stream for no offline gain.
  The register already embeds the full back office at `/backoffice/`. Day 34 adds an **Online orders** entry to the till
  shell (`Mod+5`, shown with `order.read`) that opens `/backoffice/orders`, and a Sales › Online orders page in the portal.
  One screen, three hosts (portal, box SPA, register). _Needs your yes if you wanted a till-native, offline-capable queue._
- **D2 · Accept window = 10 minutes** (your spec; Day 32/33 left a day). Decline is allowed and refunds at once.
- **D3 · Substitution price rule: never dearer to the shopper.** The substitute is charged at its own price and tax, capped at
  what the missing quantity of the original would have cost. Cheaper → the difference is refunded. The shopper is not asked
  first (the store decides; the shopper sees what changed and the refund). _Needs your yes: ask-before-substitute is a bigger flow._
- **D4 · Documents for an adjusted order:** one **credit note** (the missing quantity of the original lines, prorated tax) and,
  when substitutes were charged, one **supplementary invoice** `…-S`. Books: one balanced entry netting both
  (clearing, sales, levies, cost of goods, inventory). Stock: `return` for the missing quantity, `sale` for substitutes.
- **D5 · Missed slot / no-show policy:** nobody picked by the end of the slot → full refund, reason `not_fulfilled`.
  Picked but not collected within 24 h after the slot → full refund, goods restocked, reason `uncollected`. No fees.
- **D6 · Cancel:** the shopper may cancel a `placed` order (releases the reservation at once). Only the store cancels a paid
  one (full refund, goods back). Both are audited commands.
- **D7 · Reviews:** one review per completed order (rating 1–5, optional comment). Auto-flag when the comment holds a link, a
  phone number or a word on a small blocklist; flagged ones wait for a moderator (`review.moderate`), the rest publish.
  Published reviews show as an average and the latest few on the store page. Reviews are about the shop, not a product.
- **D8 · No Figma frame exists for fulfilment.** Compose it from the frames you listed (Web Flow 227:4900 for the shop timeline,
  Dashboard 27:2031 for the queue table, Barcode Scanner 45:852 for scan-to-pick and empty states, New Login 173:3087 for
  form and error states, Componets 12:66 for tokens). The Figma MCP hit its plan limit on Days 32–33; S11 retries
  `get_design_context` and records any drift.

## Data · migration `0040_fulfilment.sql` + Drizzle

Schemas in `packages/db/pg/src/schemas/orders/{picking,events}.ts` and `.../reviews.ts` (names carry the context, no hyphens).

- **`online_order`**: status gains `picking`, `ready`, `out_for_delivery`, `completed`; new `accepted_at`, `ready_at`,
  `completed_at`, `fulfilled_gross` (what the shopper finally owes; = `gross` until an adjustment).
- **`online_order_event`** (the timeline and the once-only notifier): org_id, id, `order_id`, `status`, `actor_id` (nullable),
  `at`, `notified_at`. Unique `(org_id, order_id, status)`.
- **`online_order_pick`**: one row per product line: org_id, id, `order_id`, `line_id`, `outcome`
  (`picked|short|substituted`), `picked_thousandths`, substitute `product_id`/`price_id`/`quantity_thousandths`/`gross`/`payload`
  (name + tax snapshot), `picker_id`, `picked_at`. Unique `(org_id, order_id, line_id)`.
- **`online_order_adjustment`**: one per order: `before_gross`, `after_gross`, `refund_amount`, `refund_id`, the credit note and
  supplementary invoice numbers. Unique `(org_id, order_id)`; check `after + refund = before`.
- **`order_refund`**: reason gains `declined`, `short_pick`, `not_fulfilled`, `uncollected`, `cancelled` is already there.
- **`order_review`**: org_id, id, `order_id` (unique), `rating` (1–5 check), `comment`, `status`
  (`submitted|flagged|published|rejected`), `flag_reason`, `decided_by`, `decided_at`, `published_at`.
- Permissions are data: `order.read`, `order.fulfil`, `review.moderate` are added to `permissionNames`, the backoffice role
  picker, and the owner / manager / cashier seeds (`order.read` + `order.fulfil` for cashier). Add every new table to the
  schema inventory and the tenant sweep list.

## Behaviour

### Order workflow (`workflows/order.ts` grows; fulfilment steps in `workflows/orders/fulfil.ts` so each stays under 250 lines)

```
held → wait payment.settled (hold) → paid
     → wait store.accepted (10 min; payload {declined?}) → accepted | refund(not_accepted / declined)
     → sleepUntil(slotStart − 1h) → step "pick_due": event row + queue message order.pick_due (pickers)
     → wait picked (until slotEnd)      → ready | refund(not_fulfilled)
     → wait handed_over (slotEnd + 24h) → completed | refund(uncollected)
     → after commit the route starts the Review workflow
```

Every wait returns its payload; the store's **cancel** command wakes whichever wait is open (status → event type), and each
step re-reads the order so a cancelled run stops. Every step is an audited command that also updates `workflow_run`.

### Store commands (`orders/fulfil/*`, each `defineCommand` + audit + `online_order_event`)

`accept` / `decline`, `startPicking`, `recordPick(line)`, `finishPicking` (runs the adjustment in the same transaction, then
sends `picked`), `dispatch` (delivery only → `out_for_delivery`), `handOver` (sends `handed_over`), `cancel` (store, paid
stages; generalises `refundPaidOrder` to every status from `paid` to `ready`). Shopper `cancelPlaced` releases holds.

### Adjustment (S5, the key transaction)

For each line: sold `q`, picked `p`, optional substitute. Missing = `q − p`; the original line is re-quoted at the saved price
version and tax rules for the missing quantity (prorated tax, exact to the pesewa through `@shopper/money` / the till's
`quoteFrom`). The substitute is quoted the same way at pick time and capped by D3. Then, in one transaction: pick rows,
`stock_movement` (`return` / `sale`; a substitute with no stock is refused), `order_refund` for `paid − final`, credit note and
supplementary invoice through `recordFiscalDoc`, one balanced `postEntry`, `online_order.fulfilled_gross`, adjustment row,
audit row, `order.status` message queued after commit. A replay changes nothing.

## Slices (tests first, one commit each; `vp check` + `vp run guard` + the slice's tests before each commit)

| #   | Slice                                                    | Tests written first (`tests/integration/…`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0  | Spike (no commit)                                        | Read `apply.ts` (`owe` amount), `quotation.ts` (`quoteFrom` at a smaller quantity), `ledger/post.ts` (source/sourceId uniqueness, `reversesId`), `fiscal_doc` constraints, `workflowInstanceIdSchema` (review id), barcode lookup, realtime port. Record answers at the top of this file.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| S1  | Data + permissions                                       | `schema/inventory.test.ts` + tenant sweep list include the new tables; constraints (one pick per line, adjustment `after + refund = before`, rating 1–5, one review per order); seeds grant the new permissions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| S2  | Accept window, decline, cancel                           | `workflows/orders/accept.test.ts`: no accept in 10 min → refunded (`not_accepted`); decline → refunded at once; accept → `accepted`; cancel of a `placed` order releases the hold, the run ends; store cancel from `paid`/`accepted`/`picking`/`ready` refunds once, stock back, credit note queued. Break check: remove the status guard and watch the double-refund test fail.                                                                                                                                                                                                                                                                                                                                                        |
| S3  | Slot timing + pick workflow                              | `workflows/orders/fulfil.test.ts`: `sleepUntil(slot − 1h)` then `order.pick_due` queued once; wait `picked` → `ready`; no pick by slot end → refund `not_fulfilled`; wait `handed_over` → `completed`; no collect → refund `uncollected` with goods restocked; each step has an audit row and `workflow_run` updated.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| S4  | Staff API + queue read                                   | `orders/queue.test.ts`: `GET /orders` is branch-scoped (a branch-scoped member sees only theirs), filters by stage, counts per stage, ordered by slot; `order.read` vs `order.fulfil` enforced (403s); tenant sweep covers every new route; bodies in `tests/support/security/bodies.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| S5  | **Picking, substitution, partial refund (the key test)** | `orders/fulfil/consistency.test.ts`: **order → pay → accept → pick (one line full, one short, one substituted by a cheaper product) → ready → handed over; stock net = sold − missing + substitute, journal balanced and equal to hand-computed totals per account, credit note + supplementary invoice with prorated tax, one `order_refund` of `paid − final` and exactly one Paystack call on redelivery, receipt/adjustment consistent, all in one transaction, replay a no-op.** Also: substitute dearer than the missing line is capped; substitute with no stock refused; all picked → no adjustment, no refund; everything short → equals a full refund. Break checks: drop the stock `return`, drop the cap, each fail a test. |
| S6  | Customer status                                          | `orders/fulfil/notify.test.ts`: `ready` / `out_for_delivery` / `completed` each queue one `order.status` SMS (pickup vs delivery wording, adjusted-order wording with the refund); redelivery sends nothing twice; no SMS credentials → retry then dead-letter; `GET /shop/:code/orders/:id` returns the timeline events and the adjustment, never another shopper's order.                                                                                                                                                                                                                                                                                                                                                             |
| S7  | Review workflow + table                                  | `workflows/orders/review.test.ts`: sleep 48 h → `review.ask` SMS once; no review in 7 d → run ends with no row; clean review publishes; link / phone number / blocklist word flags it and waits for `moderator_decision`; approve publishes, reject keeps it hidden; one review per order; only a completed order can be reviewed; public list shows published only.                                                                                                                                                                                                                                                                                                                                                                    |
| S8  | Wiring: cloud and box parity                             | `adapters` twins: `OnlineReviewWorkflow` + binding in `apps/edge/cloudflare.config.ts`, `boxOrderReviews` (same shortcut note as the other box twins), `reviewFlows` in `ApiOptions`/`ShopOptions`, new rate-limit policy `review`. Existing launchers run the new functions in the integration suite; no port change, so no conformance change. Security docs updated.                                                                                                                                                                                                                                                                                                                                                                 |
| S9  | Back office UI                                           | `tests/e2e/portal/orders/{queue,pick}.spec.ts` (see UI): accept, scan-pick, short, substitute, finish, hand over, decline; keyboard path; branch-scoped member; empty and error states.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| S10 | Shop UI + till entry                                     | `tests/e2e/shop/fulfil.spec.ts` (timeline through each status, adjusted order, cancel, review form, reviews on the store page); `tests/e2e/till/ui/orders.spec.ts` (Online orders tab with `order.read`, hidden without).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| S11 | Docs, verification, review                               | `docs/plans/day34/verification.md`; `platforms.md` (order workflow stages, review workflow, bindings), `security.md` (staff order routes, review routes, public lists), `frontend.md` (queue, pick list, timeline). Codex review (`gpt-6.1-sol`) run from Bash, fixes with tests. Skeleton audit for the queue, pick list and order page.                                                                                                                                                                                                                                                                                                                                                                                               |

If time runs short, cut in this order and say so in the remarks: store-page review block, moderation screen (API + workflow stay),
till entry badge. The milestone (S0–S6, S9, S10 order flow) is never cut.

## UI · `/ui-screen` → `/ui-verify` → `/skeleton-audit`

**Back office (`packages/backoffice`)**, `screens/orders/{queue,pick}/screen.tsx`, `components/orders/`, `queries/orders/`,
`routes/orders`; nav item Sales › **Online orders** (`order.read`), also the palette.

- **Queue**: tabs New · Preparing · Ready · Done with counts, branch filter (locked for a branch-scoped member), table of
  order number, customer, slot (relative: "in 40 min"), pickup/delivery, items, total, status. Row action by stage (Accept,
  Start picking, Mark handed over). `N` focuses the next unaccepted order, `/` search, Enter opens. Polls on an interval
  (TanStack Query, no effects).
- **Pick list**: lines grouped as the shelf order, each with quantity needed, a stepper, **Short**, **Substitute…**; a scan field
  (keyboard-wedge scanners type digits then Enter; a match ticks that line); progress bar; **Finish picking** shows a
  confirmation with the exact refund before it commits. Substitute picker searches the branch's products with stock, shows the
  price and the capped charge. Decline and Cancel ask for confirmation.
- States: loading skeleton, empty per tab ("No orders waiting. New orders appear here."), error with retry, offline banner,
  conflict ("This order moved, refreshed"), permission-limited (read only without `order.fulfil`).

**Shop (`apps/shop`)**: the order page gets a **timeline** (Paid → Accepted → Preparing → Ready/Out → Collected/Delivered, with
times), an "Your order changed" card with what was short/substituted and the refund, **Cancel order** while `placed`, a review
form (stars + comment, `1`–`5` keys) when completed, and the store page shows the average and latest reviews.

**Till**: shell tab **Online orders** (`Mod+5`, `order.read`) → `/backoffice/orders`, with the count of orders waiting.

Verify with `playwright-cli` at 1920, 1440, 768, 390 and the till size; screenshots in `docs/plans/day34/screenshots/`; axe
and overflow checks; Figma drift recorded.

## How I will work (your instructions)

- **No subagents.** Everything inline on Sonnet high. Skills and CLIs used directly: `tdd-slice` per slice, `cloud-box-parity`
  and the `cloudflare` / `workers-best-practices` skills for the workflow + bindings, `ui-screen`, `ui-verify`,
  `skeleton-audit` with `playwright-cli`, `pre-merge-review` via `codex review` from Bash, `cf` CLI (never wrangler).
- Tests first and meaningful (each proven by a deliberate break), then implementation, then the full suite and fixes.
  Load-only timeouts that pass alone are noted, not hidden.
- **Commit after every green slice. Push only when all slices are done.** No AI attribution anywhere.
- Reset freely: `vp run services:down` with volumes, `vp run db:migrate`, `vp run db:seed`; D1/KV/DO state is wiped by
  recreating the local runtime. Nothing is deployed on Day 34.

## Ship

1. `vp check`, `vp run guard`, `vp test --run`, `vp run build`, Playwright projects green.
2. Push `day34-fulfilment`, open the PR, bind it with `ccd_pr`, turn on Auto-fix.
3. Watch CI to green (I fix, push, repeat). Merge when green. Fast-forward local `main`.
4. Update the Notion **34 · Fulfilment** row: tick tasks and tests, Status = Done, add Progress and Remarks in the Day 32/33
   format (PR link, migration, what was built, Codex findings, CI notes, known limits, next).

## Known limits to carry into the remarks

- No courier app or tracking: delivery is statuses the store sets by hand. No ask-before-substitute.
- Hubtel refunds stay manual (`refund_due`), including partial ones.
- Box waits and sleeps are in-process until Rivet (Day 36).
- Online orders are still absent from the store-day sales report and transactions explorer (they read `sale`).
- Live Paystack/Hubtel/SMS are covered by fakes; nothing is deployed.
