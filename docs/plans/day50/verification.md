# Day 50 verification — v1.5 · 5 · Order inbox

## What shipped

- **Inbox on the Publisher run.** Each run on the box: take paid orders → decide → publish → tell the relay →
  heartbeat (`relay/inbox/box.ts`). No new actor or timer: the minute's run and every write's wake drive it, and the
  relay gives the box 10 minutes to decide.
- **Take (cursor + ack).** `GET /relay/orders` offers up to 100 `paid` orders with `relay_acked_at IS NULL`, with
  their lines (paid price version, tax snapshot), slot, customer and receipt. The box's first event for an order acks
  it. The box inserts orders as its own (`channel = 'relay'`, same ids, `ON CONFLICT DO NOTHING`), so a redelivered
  order is processed once. The Day 46 placement cursor is gone: orders are paid out of placement order.
- **Decide.** `reserveStock` at the branch (holds until a day after the slot). If any line is short, the order is
  `refunded` on the box and the relay refunds it through Paystack. Otherwise it is `accepted`, and every line keeps
  the paid price. `checkPrices` re-quotes each line with the till's own `quoteCart`; a different price version, gross,
  or any levy is recorded in `online_order.price_check`.
- **Status events up.** Box `online_order_event` rows with `relayed_at IS NULL` go to `POST /relay/orders/events` in
  order (≤ 500 per request), with the open order ids (≤ 1000). The relay accepts, declines or cancels (refunds), or moves the order to
  picking / ready / out for delivery / completed, texts the shopper and wakes the order workflow. A wake lost after a
  committed move is sent again when the box retries. The answer lists the orders the relay has refunded (its own
  timeouts); the box frees their holds.
- **Stock counted once.** On a relay org, `availableOf` leaves out sale movements of acked orders: the box's
  published figure already carries its hold. Publishing before telling means the relay can briefly show less
  stock, never more.
- **On the box:** relayed orders send no workflow events, wake the Publisher, cancel by freeing holds, turn holds
  into sale movements at hand-over, refuse short or substitute picks, and are never texted from the box.
- **Refund SMS.** `refundPaidOrder` now queues `order.status` `refunded` ("… was cancelled and refunded. GH₵ X is on
  its way back to you."), for cloud shops too.
- **Pick screen.** "Prices changed since this order was paid — Charge what the customer paid", with the paid and the
  current amount for each changed line. A relayed order has no "Short or substitute…" button.
- Migration `0051_relay_orders.sql` (replayable): `online_order.relay_acked_at`, `online_order.price_check`,
  `online_order_event.relayed_at`.

## Tests

- `relay/orders.test.ts` (new, 8): a paid order reaches the box's queue accepted and held, the relay order is accepted
  and the relay's available is not counted twice; the same order delivered twice (lost answer) is processed once; an
  out-of-stock order is rejected, refunded through Paystack and the shopper texted; a price changed after the order
  keeps the paid price and is flagged; picking and handing over on the box completes the order on the relay (sale
  movements on the box, no box SMS); a relay timeout frees the box's holds and a box cancel refunds on the relay; a lost
  workflow wake is sent again on retry (seen failing with the fix removed); a tax-only change is flagged.
- Updated: `relay/auth.test.ts` (inbox shape), `relay/heartbeat.test.ts` and `relay/publisher.test.ts` (a run pulls
  orders first; a refusal now stops it at the inbox).
- `e2e/portal/orders/pick.spec.ts`: the relayed order's price notice and no short button, screenshots at 1920, 1440,
  768 and 390 with axe and overflow checks (9/9 pass).
- Relay (39), orders, shop, payments and stock (244) integration suites pass; full `vp test --run`, `vp check` and
  `vp run guard` are clean.

## Review

- Codex (`gpt-6.1-sol`, medium), pass 1: 4 findings, all confirmed and fixed (nullable landmark in relayed addresses;
  lost workflow wake after a committed move; event batches over the endpoint's limits; tax-only changes not flagged).
- Pass 2 could not run: the Codex usage limit was reached. The fixes were reviewed by hand against the reviewer
  checklist; no new findings.

## Known limits

- Relayed orders are picked in full or cancelled; partial picks need a relay-side adjustment.
- The relay org invoices at payment (fiscal on the relay), not the box at fulfilment.
- Status updates reach the shopper by SMS only; there are no status emails yet.
- The acceptance window is the 10 minutes every online order has, not 30.
- Figma has no orders or picking frame. The notice follows the Components page and the existing pick screen.
