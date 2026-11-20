# Day 50 — v1.5 · 5 · Order inbox

## Context

Notion row "v1.5 · 5 · Order inbox" (Box, Till, API, P0).

- Order inbox on the box: pulls paid orders outbound (cursor + ack), idempotent on order ID.
- Accept/reject against real stock within the acceptance deadline; reservation on accept.
- Accepted orders appear on the picking screen (v1.0 day 34).
- Status events up: accepted, picking, ready, out for delivery, completed.
- Rejection or timeout → automatic Paystack refund + customer SMS/email.
- Honour the paid `price_version_id`; recompute tax and flag any mismatch.

Tests from the row: same order delivered twice → processed once; out-of-stock order → rejected → refunded; price
changed after order → paid price honoured, mismatch flagged. **Done when:** a paid online order reaches the picking
screen of an offline-by-default shop.

Working rules (user, memory): no subagents; tests first; one commit per slice; push once at the end; PR, watch CI until
green (fix and push if red), merge; update Notion. Data is disposable.

## What exists (traced)

| Need                         | Today                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Order lifecycle on the relay | `runOnlineOrder` (cloud): hold → paid → waits `store.accepted` 10 min, else `refundPaidOrder` + Paystack     |
| Accept / decline / cancel    | `acceptStoreOrder`, `declineStoreOrder` (refund), `cancelStoreOrder` (refund) — staff routes `/orders/:id/*` |
| Picking screen               | backoffice `screens/orders/{queue,pick}` over `/orders` (`listOrderQueue`, `readStaffOrder`) — box serves it |
| Reservation                  | `reserveStock` (`orders/holds.ts`): holds every line or reports the short ones                               |
| Relay inbox route            | `GET /relay/orders?store&after` → id/status/cursor only (Day 46 stub)                                        |
| Box outbound loop            | Publisher run (`publishPending`): publish what is due, then heartbeat; woken by writes, every 60 s           |
| Price quote                  | `quoteCart` — the till's own quote at a branch and time (price version id + tax snapshot per line)           |
| Shopper status SMS           | `deliverOrderStatus`: ready / out_for_delivery / completed only; nothing on a refund                         |

## Decisions

1. **The inbox is a step of the existing Publisher run, not a new actor.** Each run: pull orders → decide → publish
   what is due → push order events → heartbeat. One outbound loop per org already exists, runs every minute and on
   every write, and serialises the box's relay traffic; a separate Rivet actor would add a sixth hot-coordination
   class (the rules say ask first) for no gain. The relay gives the box 10 minutes to decide; the loop runs at least
   every 60 s.
2. **Pull = paid, un-acknowledged orders; ack = the box's decision.** `GET /relay/orders` returns up to 100 orders in
   status `paid` with `relay_acked_at IS NULL`, oldest payment first, with their lines (product, price version,
   quantity, gross, tax snapshot), slot, customer and receipt. A placement cursor cannot work: an order is paid in a
   different order from the one it was placed in, so a cursor past an unpaid order would skip it once paid. The box
   inserts each order with `ON CONFLICT (org_id, id) DO NOTHING`, so a redelivered order is processed once. The ack is
   the decision event the box pushes; until then the relay keeps offering it.
3. **The box mirrors the order** as its own `online_order` (same ids, `channel = 'relay'`, status `paid`, the paid
   lines and receipt), so the existing queue, pick screen, picking commands and timeline work unchanged.
4. **Decide against real stock**: `reserveStock` at the order's branch, holds expiring a day after the slot ends.
   Short → the box order is `refunded` (event `refunded`); otherwise `accepted` (event `accepted`). One audited command
   per order (`relay.order.decided`).
5. **Price honesty.** The box keeps the paid lines (the paid `price_id` and gross are never rewritten). On accept it
   re-quotes each line with `quoteCart` at its branch now; any line whose current price version or gross differs is
   recorded in `online_order.price_check` (`[{ lineId, name, paidPriceId, paid, priceId, now }]`). The pick screen
   shows "Prices changed since this order was paid — charge what the customer paid" with the lines.
6. **Status events up through an outbox.** Every box status change already writes `online_order_event`; a new
   `relayed_at` marks those told to the relay. `POST /relay/orders/events { events: [{ id, status }], open: [ids] }`
   applies each event once on the relay (idempotent: a status the relay order already passed is skipped):
   - `accepted` → `acceptOrder` + workflow `store.accepted`
   - `refunded` → paid: decline (refund) + `store.accepted {declined}`; later: cancel (refund) + the open wait's event
   - `picking` → move to picking; `ready` → move to ready + shopper SMS + workflow `picked`
   - `out_for_delivery` → move + SMS; `completed` → move + SMS + workflow `handed_over`

   Any event acks the order (`relay_acked_at`). The answer lists which of the events' and `open` orders the relay has
   refunded (its own timeouts: not accepted in time, not picked by slot end, not collected); the box then marks those
   refunded and gives their holds back.

7. **Order of a run matters for stock.** On the relay, payment already took the goods off its shelf (a sale movement).
   Once the box has the order, the box's published availability carries it (its hold), so the relay's `availableOf`
   leaves out movements of acknowledged orders. The run publishes **before** it acks: in between the relay counts the
   order twice (shows less, never more).
8. **Refund tells the shopper.** `refundPaidOrder` queues an `order.status` `refunded` message; `deliverOrderStatus`
   texts "… could not be filled. {gross} is on its way back to you." This covers decline, timeout and cancel, cloud
   shops too. `shortcut: SMS only; status emails do not exist yet — add an email template if a shop asks.`
9. **Box-side fulfilment for relay orders.** The box has no payment for them, so:
   - cancel → release holds, status `refunded` (the relay refunds when the event arrives);
   - finishing a pick with a short or substitute is refused ("Pick it in full or cancel it") —
     `shortcut: partial picks need a relay adjustment; build when a shop asks`;
   - hand-over releases the holds and writes the sale movements (the goods leave the shelf);
   - no workflow events and no shopper SMS from the box (the relay owns both); staff actions wake the Publisher.

## Behaviours as tests (written first, each seen failing)

`tests/integration/relay/orders.test.ts` (new; a paid order on a relay org from `fulfilWorld`, the org flipped to
relay mode and enrolled; a box database mirroring its store, branch, products and prices with the same ids):

1. **A paid order reaches the box's picking queue.** One run: the box has the order (accepted, lines and paid gross as
   paid, holds for every line), it is in `listOrderQueue`; the relay order is `accepted` and its workflow moves on; the
   relay's available for the product equals the box's.
2. **Same order delivered twice → processed once.** The relay offers it again (ack lost): one box order, one set of
   holds, one `accepted` event on each side.
3. **Out-of-stock → rejected → refunded.** Box has none: box order `refunded`, no holds; relay order `refunded`, a
   refund owed and queued, the shopper's `refunded` SMS sent.
4. **Price changed after order → paid price honoured, mismatch flagged.** New price on the box before the run: box
   order lines keep the paid price id and gross; `price_check` names the line with both prices; `readStaffOrder` shows it.
5. **Status events up.** Box: start → finish (full pick) → hand over. After the next run the relay order is `completed`
   with picking/ready/completed events, the SMS for ready went out on the relay, the box's holds are released and its
   sale movements written.
6. **Relay timeout → box gives back.** The relay refunds an accepted order (not picked by slot end); the next run marks
   the box order refunded and frees its holds. A box cancel goes up and refunds on the relay.

Existing tests updated: `relay/auth.test.ts` (inbox shape), `relay/heartbeat.test.ts` (a run now pulls first),
`orders` status-message tests if they count queued messages.

`tests/e2e/portal/orders` pick screen: **price flag shows** (replayed staff order with `priceCheck`): the notice and
lines at all sizes, no console errors.

## Changes

- **`@shopper/db-pg`**: `orderChannels` + `relay`; `online_order.relay_acked_at`, `online_order.price_check`;
  `online_order_event.relayed_at`; migration `0051_relay_orders.sql`.
- **`@shopper/core`**:
  - `relay/inbox/relay.ts` (relay side): `relayInbox` (paid, un-acked, full orders), `applyRelayEvents`.
  - `relay/inbox/box.ts` (box side): `pullOrders`, `decideOrders` (reserve + price check), `pushOrderEvents`.
  - `relay/publisher.ts`: the run calls pull → decide → publish → push → heartbeat.
  - `stock/onhand.ts`: `availableOf` leaves out movements of acknowledged orders.
  - `orders/fulfil/{actions,pick,handover,queue,status}.ts`, `orders/payments/refunds/compensate.ts`: relay channel
    rules (decision 9), `channel` + `priceCheck` on the staff order, the `refunded` SMS.
- **`@shopper/api`**: `GET /relay/orders` new shape, `POST /relay/orders/events` (relay routes get `orderFlows`);
  `/orders/*` writes wake the Publisher and send no workflow events for relay orders.
- **`@shopper/backoffice`**: pick screen price-check notice (`components/orders/pick/prices.tsx`), schema field.

## UI

- Pick screen: an `Alert` (warning tone) above the lines when `priceCheck` is non-empty: title "Prices changed since
  this order was paid", body "Charge what the customer paid." and one row per line: name, paid, now. Keyboard order
  unchanged; no new loading state.
- Figma: the supplied file has Components, Dashboard, Web Flow, Login, New Login and Barcode Scanner pages, no orders
  or picking frame; follow the Components page tokens and the existing pick screen.
- `/ui-verify` with playwright-cli at desktop, laptop, tablet, mobile, till; console; overflow.

## Rules at risk

- **Audit:** receive/decide/event/cancel are `defineCommand`s; the relay's event application is one command per event.
- **Tenancy:** relay endpoints act on the licence's org only; every query filters `org_id`.
- **Money:** no arithmetic on the box beyond comparing integers; refunds use the existing `owe`.
- **No new DO/actor, no cron:** the inbox rides the Publisher run.
- **Size:** `publisher.ts` is 239 lines; inbox code lives in `relay/inbox/`.

## Slices (commit after each)

- **S1 Relay inbox and events (relay side).** Migration, schema, `relayInbox`, `applyRelayEvents`, routes, refund SMS,
  `availableOf` ack exclusion.
- **S2 Box inbox.** pull, decide (reserve + price check), push, Publisher wiring; box-side fulfilment rules; tests 1–6.
- **S3 Pick screen price flag.** Staff order fields, UI notice, e2e, `/ui-verify`.
- **S4 Docs, review, ship.** `platforms.md` relay section, owner guide line, `verification.md`; `vp check`, `vp run
  guard`, `vp test --run`; `/pre-merge-review` (Codex); push, PR, CI green, merge; Notion row.

## Not in scope

- Partial picks and substitutions for relay orders (refused with a clear message).
- Fiscalising relay orders on the box (the relay org invoices at payment today); purge of completed relay orders (Day 53).
- A 30-minute relay acceptance window (the relay keeps the 10-minute window every online order has).
