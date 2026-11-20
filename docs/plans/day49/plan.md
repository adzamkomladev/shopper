# Day 49 — v1.5 · 4 · Availability & heartbeat

## Context

Notion row "v1.5 · 4 · Availability & heartbeat" (Box, Shop, Sync, P0).

- Availability per branch = on hand − reserved − safety buffer; publish on threshold crossings, debounced to ≤ every 30 s.
- Heartbeat every 60 s; the storefront shows **"Online ordering paused"** per branch after 5 min of silence in opening hours.
- Carts preserved while paused.

Integration tests from the row: box silent 5 min → branch paused, heartbeat returns → resumes; 100 in-store sales of
one SKU publish availability a handful of times, not 100. **Done when:** the store never offers what the shop can't fill.

Working rules (user, memory): no subagents; tests first; one commit per slice; push once at the end; PR, watch CI until
green (fix and push if red), merge; update Notion. Data is disposable.

## What exists (traced)

| Need                     | Today                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| Storefront "in stock"    | `availableOf` (`core/stock/onhand.ts`) = movements − live holds; listing, product page, cart, holds   |
| Relay org stock          | **none**: the relay has no `stock_movement`, so every relay product reads 0 and is never listed       |
| Relay heartbeat route    | `POST /relay/heartbeat` → `relayHeartbeat` sets `relay_box.last_seen_at` (Day 46, no audit: liveness) |
| Box sends heartbeat      | **never**                                                                                             |
| Storefront closed/paused | `listSlots` → `{pickup, delivery, slots}`; checkout shows "not taking online orders" when both false  |
| Order refusal            | `placeOrder` → `OrderError("closed" \| "slot" \| "stock")`                                            |
| Cart                     | client-side (`useCart`, local storage); the server only quotes it                                     |
| Publisher                | ends when idle; woken by catalogue/fulfilment writes; hash diff per row in `relay_published`          |

So the work is: a new `availability` kind on the wire, one more term in `availableOf`, the box actually beating, and a
`paused` flag the storefront and `placeOrder` honour.

## Decisions

1. **One definition, both sides.** `relayProjection` gains `availability`: per online product, per branch,
   `ladder(availableOf − buffer)`. The relay reads its copy with the same function. On the relay `availableOf` is the
   published figure (no movements) less its own live holds, the relay's buffer is 0, and `ladder` is idempotent, so the
   existing "relay projection equals box projection" tests keep proving the copy is exact.
2. **Threshold crossings = a ladder of lower bounds.** Available is floored to the nearest step of
   `0, 1, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000` base units (in thousandths on the wire). The row's
   hash only changes when the step changes, so the existing hash diff _is_ the crossing detector. Flooring means the
   relay never shows more than the box has. 100 sales from 120 → 20 cross twice (100→50, 50→20).
   `shortcut: weighed products under 1 kg/l floor to 0 and are not sold online; add fractional steps if a shop asks.`
3. **Debounce per product row, sold-out at once.** An availability row is due when its hash differs **and** either it
   was last published ≥ 30 s ago (`relay_published.published_at`) or any branch reached 0. A rise waits; selling out
   never does, because "never offer what the shop can't fill" beats the rate cap. Held rows go on the next run.
4. **Safety buffer = one shop-wide number of base units**, `org.online_buffer` (integer thousandths, default 0), saved
   with the existing Online Orders switch (`settings.online`, audited). Per-product buffers are not built.
5. **Reserved = the box's live holds**, already inside `availableOf`. Relay holds (Day 50 orders) are subtracted on the
   relay by the same `availableOf`.
6. **Relay storage:** table `online_availability (org_id, branch_id, product_id, quantity_thousandths, updated_at)`,
   PK `(org_id, branch_id, product_id)`, under the relay lock trigger (only `relay.publish` writes it). `availableOf`
   adds `COALESCE(online_availability.quantity_thousandths, 0)`; a cloud org has no rows, so nothing changes for it.
   Migration `0050_relay_availability.sql` (table, trigger, `org.online_buffer`, `relay_published.entity` gains
   `availability`).
7. **Wire row:** `availability: [{ id: productId, branches: [{ branchId, available }] }]`, strict, branches sorted.
   One row per product keeps `relay_published` keyed by a uuid as today.
8. **Heartbeat + wake tick on the box:** `bootRelayPublisher` starts one `setInterval(60 s)` that, for each org with
   Online Orders on, POSTs `/relay/heartbeat` and wakes the Publisher. The wake makes held rises and sales that did not
   wake it go out within a minute. Liveness, not business logic: no cron, no workflow history per beat. Stock routes
   (`/stock/*` writes) and the till sync push also wake the Publisher through the existing `wakePublisher`, so a
   sell-out goes up within seconds.
9. **Paused = relay org ∧ `last_seen_at` older than 5 min (or never) ∧ now inside the branch's opens–closes.** Out of
   hours a silent box is normal (it may be off overnight). `listSlots` returns `paused: true`; `placeOrder` refuses
   with `OrderError("paused", "Online ordering is paused at this branch. Your cart is kept; try again soon.")` (409).
   A cloud org is never paused. The cart quote is untouched, so carts survive.

## Behaviours as tests (written first, each seen failing)

`tests/integration/relay/availability.test.ts` (new; `relayCloud()` + box `emptyDatabase()` like `publisher.test.ts`):

1. **100 in-store sales publish a handful of times.** One SKU with 120 on hand at branch A. Snapshot, then 100 sales
   (`stock_movement` reason `sale`, −1 each), calling `publishPending` after each with `now` advancing 2 s. Availability
   rows sent ≤ 5 (not 100); after every run the relay's available ≤ the box's true available; final relay figure = 20.
2. **Sold out goes at once, rises wait 30 s.** Sell the last unit: published on the same run even inside 30 s; the
   relay's `listStoreProducts` no longer lists it. Receive 50: not published at +10 s, published at +31 s.
3. **The buffer and holds come off.** `online_buffer` 5, on hand 12, a box hold of 2 → relay shows ladder(5) = 5.
4. **Relay availability is the box's alone.** A cloud write to `online_availability` on the relay org is refused by
   the lock; a cloud org's `availableOf` is unchanged (no rows).

`tests/integration/relay/heartbeat.test.ts` (new):

5. **Box silent 5 min → paused; heartbeat returns → resumes.** Relay branch open 08:00–20:00. `last_seen_at` = now −
   6 min at 10:00: `listSlots(...).paused` is true and `placeOrder` refuses `paused`; the cart quote still prices every
   line. `POST /relay/heartbeat` (signed): `paused` false, `placeOrder` succeeds.
6. **Out of hours is not paused**, and a never-seen box during hours is paused. A cloud org is never paused.
7. **The box beats.** `bootRelayPublisher`'s tick (exported `beat()`) with a recording `send`: one `/relay/heartbeat`
   per online org, none when Online Orders is off, and the Publisher is woken.

Existing tests updated: `relay/publisher.test.ts` allowlist gains `availability: ["id", "branches"]` (wire still free of
cost/supplier/movement words); `relay/publish.test.ts` strict-object refusal for an availability row with an extra
field; `relay/lock.test.ts` covers the new table; hard-coded table counts (Day 41 note) updated.

`tests/e2e/shop/checkout.spec.ts`:

8. **Paused checkout keeps the cart.** Replay `/fulfilment` with `paused: true`: the checkout shows "Online ordering
   paused" with the branch name, the cart badge and lines are unchanged, Browse the store works; screenshots at all
   sizes, no console errors.

`tests/e2e/portal/settings` (Online Orders card):

9. **Buffer field saves.** Enter 3, save, reload: 3. Disabled while offline; validation for negative/non-integer.

## Changes

**`@shopper/db-pg`** — `schemas/relay.ts` (`onlineAvailability`, `relayPublished.entity` + `availability`),
`org.onlineBuffer`; migration `0050_relay_availability.sql`.

**`@shopper/core`**

- `stock/onhand.ts`: `availableOf` + published availability term.
- `relay/projection.ts`: `availability` kind via `availableOf`, `ladder`, `org.onlineBuffer`.
- `relay/publisher.ts`: kind after `prices`; due filter (decision 3) in `pendingRows`.
- `relay/publish.ts`: upsert `online_availability` rows.
- `schemas/relay.ts`: `availability` rows; `onlineSettingsInput` gains `buffer` (base units, integer ≥ 0, ≤ 10 000).
- `relay/settings.ts`: read/save the buffer (audited before/after).
- `orders/slots.ts`: `paused` in `listSlots` (one `relay_box`/`org.mode` read); `orders/place.ts` refuses `paused`;
  `orders/error.ts` code `paused`.

**`@shopper/api`** — `routes/stock.ts` and the sync push route take `wakePublisher` (box only; no-op on cloud);
`routes/shop/orders.ts` maps `paused` to 409 (existing OrderError handler).

**Box shell** — `apps/box/src/relay.ts`: 60 s tick (heartbeat + wake), cleared on shutdown; `adapters/box`
`boxRelayPublisher` exposes `beat()`. Cloud shell: nothing (the relay routes already exist).

## UI

- **Shop checkout** (`apps/shop/src/routes/$shop/checkout.tsx`): new `paused` branch reusing `Gone` (Store icon,
  Empty): "Online ordering is paused at {branch}" / "Your cart is saved. The shop's system is reconnecting; try again
  in a few minutes." with "Browse the store". Store pages keep browsing; the cart page's checkout button stays (the
  checkout explains). Schema `fulfilmentOptions` gains `paused`.
- **Box Online Orders card** (`components/settings/online/orders.tsx`): a number field "Hold back from the online
  store" (units per product) under the switch, shown when on; save button, pending, error, offline-disabled states.
- Figma: the supplied frames (Components, Dashboard, Web Flow, Login, Barcode Scanner) have no storefront paused or
  online-settings frame; build from existing `@shopper/ui` Empty/Field/Input patterns and the Components page tokens.
- Verify with `/ui-verify` (playwright-cli) at desktop, laptop, tablet, mobile, till; keyboard path; console; overflow.

## Rules at risk

- **Audit:** availability goes through `relay.publish` (audited per batch); the buffer through `settings.online`. The
  heartbeat stays unaudited liveness (Day 46 decision).
- **Tenancy:** every new query filters `org_id`; `online_availability` is written only under `shopper.relay`.
- **Quantities:** integer thousandths throughout; the ladder works in thousandths.
- **No business cron:** the 60 s tick is liveness; business waiting stays in the Publisher workflow.
- **Ports/adapters:** no binding in core; the timer lives in `apps/box`.
- **Size limits:** `publisher.ts` is 204 lines; the due filter goes in `projection.ts`/a small `relay/availability.ts`
  if it would pass 250.

## Slices (commit after each)

- **S1 Relay availability.** Migration, `online_availability`, `availableOf`, wire schema, `publishRelay`, projection,
  publisher kind + debounce. Tests 1–4, allowlist/strict/lock updates.
- **S2 Buffer setting.** Core input + settings command, API, Online Orders card + e2e 9, `/ui-verify`.
- **S3 Heartbeat and pause.** `listSlots.paused`, `placeOrder` refusal, box tick + `beat()`, wakes from stock and sync
  push. Tests 5–7.
- **S4 Storefront paused UI.** Checkout paused state + e2e 8, `/ui-verify`, `/skeleton-audit` not needed (no new
  loading state).
- **S5 Docs, review, ship.** `platforms.md` relay section (availability, heartbeat, pause), owner guide line on the
  buffer, `verification.md`; `vp check`, `vp run guard`, `vp test --run`, e2e; `/pre-merge-review` (Codex
  `gpt-6.1-sol`); push, PR, CI green, merge; Notion row ticked with remarks.

## Not in scope

- Per-product safety buffers; fractional ladder steps for weighed goods.
- Relay-side order acceptance and releasing relay holds when the box accepts (Day 50/51).
- A storefront-wide "paused" banner on browse pages (the checkout is where ordering happens; browsing stays useful).
