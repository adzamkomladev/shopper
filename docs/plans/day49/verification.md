# Day 49 verification — v1.5 · 4 · Availability & heartbeat

## What shipped

- **Availability on the wire.** A new projection kind, last in a batch: per online product, each branch's on hand less
  live holds less the shop's buffer, floored to a step (0, 1, 2, 3, 5, 10, 20, 50, 100 … 10 000 units;
  `relayAvailability`). The relay stores it in `online_availability` (relay lock), and `availableOf` adds it to on
  hand, so the relay store, cart and stock holds work unchanged. A cloud shop has no rows and sees no difference.
- **Threshold crossings, debounced.** Only a step change alters a row. Any drop goes up at once; a rise waits until 30 s
  after the row's last publish. `relay_published.hash` keeps an availability row's last figures (not a digest), so a
  drop can be told from a rise.
- **Safety buffer.** `org.online_buffer` (thousandths), saved with the Online Orders settings (`settings.online`,
  audited before/after) from a "Keep back from the online store" field on the box's Online Orders card.
- **Heartbeat.** Every Publisher run ends with POST `/relay/heartbeat`, only after what is due went through, so a
  reconnecting box never reopens ordering on stale stock and beats never race publishes (one run per org).
  `apps/box/src/relay.ts` starts a run every 60 s (`relaunch`) on a plain timer: liveness, not business logic.
- **Wakes.** Stock writes (`/stock/*`) and till pushes with accepted sales wake the Publisher; the minute's beat is
  the backstop.
- **Pause.** `orderingPaused`: a relay org whose box has been silent ≥ 5 min (or never beat) while the branch is inside
  its opens–closes. `GET /shop/:code/fulfilment` answers `paused`, `placeOrder` refuses with `OrderError("paused")`
  (409), the checkout shows "Online ordering is paused at {branch}" with Review your cart / Browse the store. The cart
  lives in the browser and the cart quote is unaffected, so it waits for ordering to resume.
- Migration `0050_relay_availability.sql` (replayable): `online_availability`, its lock trigger, `org.online_buffer`.
  The table is left out of Shopper Archives (the box republishes it).

## Tests

- `relay/availability.test.ts` (new, 5): 100 sales from 120 publish ≤ 5 availability rows and the relay never shows
  more than the box after any run (final 20; projections equal); a sell-out goes at once and a restock waits 30 s; a
  drop from 3 to 2 inside 30 s goes at once; buffer 5 on 12 shows 5; the relay's copy refuses a cloud-side write.
- `relay/heartbeat.test.ts` (new, 3): silent 6 min at 10:00 → paused, order refused `paused`, the cart still quotes;
  heartbeat → resumes and an order is placed; 4 min of silence is not a pause; a never-seen box pauses, out of hours
  nothing pauses, a cloud shop never pauses; the minute's run sends nothing with Online Orders off, publishes before it
  beats, and sends no heartbeat when the publish is refused.
- `catalogue/online.test.ts`: the buffer saves (3 → 3000), refuses −1, 1.5 and 10 001, is audited, wakes the Publisher;
  a stock adjustment wakes it too.
- `relay/publish.test.ts`: availability rows accepted; an extra field or a negative figure refused 400.
- `relay/publisher.test.ts`: snapshot count and allowlist include `availability`.
- `tax/schema/tax.test.ts`: table list and org_id column count.
- e2e `portal/settings/online.spec.ts`: buffer validation, save by Ctrl+Enter, the PUT body, hidden when off.
- e2e `shop/checkout.spec.ts`: paused checkout keeps the cart.
- Break-checks: without the ladder and debounce three availability tests failed; without the drop rule the drop and
  restock tests failed; without the stock wake the wake count failed.

## Checks

- `vp check`: 0 errors. `vp run guard`: clean.
- Integration: relay, shop, catalogue, stock, orders, migration, export, db, tax/schema and sync ingest suites green
  locally. A full local run hit its 40-minute timeout on the loaded machine; the full suite runs in CI.
- UI: screenshots at 1920, 1440, 1366, 768 and 390 for the buffer card (valid, invalid), and 1920, 1440, 768, 390
  for the paused checkout, with axe and horizontal-overflow checks at each size.
- Codex review (`gpt-6.1-sol`, medium, `--base main`), three passes:
  1. P1 fixed: non-zero drops were held for 30 s; now any drop goes at once.
  2. P1 fixed: a heartbeat could reopen ordering before reduced stock was published; the beat now publishes first and
     beats only on success. P2 fixed: availability inserts are chunked under PostgreSQL's bound-parameter limit.
  3. P1 fixed: the beat's publish ran outside the Publisher's one-run-per-org; the heartbeat now lives inside the run.
     P2 fixed: the buffer form shares the switch's save, so it cannot turn ordering back on behind a pending switch-off.

## Not done / known limits

- Weighed goods under one unit floor to 0 and are not offered online.
- One shop-wide buffer; no per-product buffers.
- Releasing relay holds when the box accepts an order is Day 50/51.
- A till push's wake and the availability insert chunking have no dedicated test (sync push setup and a 20 000-row
  batch are heavy); the minute's beat covers a missed wake.
- Figma has no storefront or online-settings frame; both screens follow existing `@shopper/ui` patterns.
- The settings page breadcrumb reads "Customers / Loyalty" on the Online store tab (seen in screenshots; existed before
  this change).
