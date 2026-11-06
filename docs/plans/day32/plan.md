# Day 32 · Cart & checkout (+ make the general ledger findable)

> As built: the StockHolds port only arms the expiry alarm (`watch`); the holds are written in the order's own
> transaction, so the port never needs `hold`/`release`. Slots are picked by day, then start time.

## Context

Notion row **32 · Cart & checkout** (Phase 5, P0, surfaces Shop + Tax). It asks for:

- a StockHold DO for online checkouts, with holds released by an alarm;
- an online order Workflow skeleton (instance id = order_id): hold → child Payment → wait `store_accepted`;
- a cart with live pricing and tax from the same `@shopper/tax`;
- guest checkout, with pickup or delivery slots per branch and delivery fees;
- order creation that reserves stock;
- the v1.5 hook: orders carry `channel` and the `price_version_id` the customer saw, plus an order-inbox cursor.

Tests: the cart total equals the till total for the same basket, and a reservation stops the shop and the till overselling the last unit. **Done when a customer can place an unpaid order.**

**The ledger.** The ledger already exists: Day 31 shipped a full general ledger in PR #48 (`/ledger`, `ledger.read`). The owner could not find it because the sidebar calls it **"Books"**. Fix: call it **"General ledger"** everywhere (sidebar, palette, page title, tabs heading, docs, e2e tests). Owner, admin and accountant roles already hold `ledger.read`. Add a test that proves the owner sees the link.

**Decisions.**

- Fulfilment is simple and per branch: pickup on/off, delivery on/off, one flat delivery fee, opening hours, slot length, orders per slot and a lead time, all set on the branch screen.
- Data is disposable. The migration may add NOT NULL columns without a backfill, and dev and staging may be reset.
- No subagents: everything runs inline with this model. Skills and CLIs are used directly.

**Figma** (file `4MtEIWv8yBUBYgkrk4ubPk`):

- **Web Flow 227:4900**: the "Checkout" frame (bottom right) is the cart panel. It has numbered lines, a qty stepper, Clear cart, Total with an item count, and a primary Checkout button. Pull exact values with `get_design_context` on that frame while building.
- **New Login 173:3087**: field and error states for the checkout form.
- **Componets 12:66**: tokens.
- **Dashboard 27:2031**: the settings form layout for branch fulfilment.
- **Barcode Scanner 45:852**: empty states.

There is no online checkout frame, so the checkout composes these on the Day 30/31 shop theme.

## Branch, commits and shipping

Work on branch `day32-cart-checkout` off `main` (709ea21). Commit after each green slice; each slice below is a commit. Push only at the end.

Then, in order:

1. Open the PR.
2. Bind it with `ccd_pr` and turn on Auto-fix.
3. Wait for CI to go green, fixing and pushing as needed.
4. Merge.
5. Fast-forward local `main`.
6. Update the Notion Day 32 row: tick the tasks, set Status = Done, add Progress and Remarks in the Day 31 format.

No AI attribution anywhere.

Skills used inline:

- `tdd-slice` for every slice;
- `cloud-box-parity` plus the `durable-objects` and `workers-best-practices` skills for the DO, port, adapter and conformance work;
- `ui-screen`, `ui-verify` and `skeleton-audit` (via `playwright-cli`) for the UI;
- `pre-merge-review` with `codex review` on `gpt-6.1-sol` run directly from Bash (fall back to `/code-review` if Codex is over quota);
- `vp check`, `vp run guard` and `vp test --run` before each commit.

## Slice 0 · Rename Books → General ledger (commit 1)

- `packages/backoffice/src/lib/shell/nav/items.ts`: rename the section and label to "General ledger" and keep the `/ledger` route.
- Change the heading and title in `packages/backoffice/src/components/ledger/tabs.tsx` and the ledger screens.
- Update the e2e specs and nav-count tests that look for "Books" (`tests/e2e/portal/**`), and `docs/engineering/frontend.md` ("Books and the store").
- Test: the owner session's sidebar shows a "General ledger" link that opens the trial balance.

## Slice 1 · Data (commit 2): migration `0038_orders.sql` + Drizzle

Drizzle schemas go in `packages/db/pg/src/schemas/orders/{base,holds}.ts` plus a `fulfilment` addition in `base.ts`. Every table gets org_id, a UUIDv7 id and composite FKs as in `schemas/customers/base.ts`.

- **`branch_fulfilment`** (one row per branch, keyed org_id + branch_id): `pickup` bool, `delivery` bool, `delivery_fee` money, `opens` / `closes` (time, Accra), `slot_minutes` (30/60/120), `slot_capacity` int, `lead_minutes` int.
- **`online_order`**:
  - `channel` (`'online'`, checked; v1.5 adds `'relay'`), `status` (`placed|expired|cancelled|paid|accepted|…`; Day 32 writes only the first three);
  - `branch_id`, `store_id`, `inbox_cursor` bigint (unique per store, from `Sequencer.next`), `number` (= cursor, shown to the customer);
  - `fulfilment` (`pickup|delivery`), `slot_start`, `slot_end`, `delivery_address` jsonb (null for pickup), `delivery_fee`;
  - `customer_name`, `customer_phone`, optional `shop_account_id`, `view_token_hash`;
  - snapshot totals: `base`, `vat`, `nhil`, `getfund`, `covid`, `gross`;
  - `hold_expires_at`, `placed_at`.
- **`online_order_line`**: `order_id`, `product_id`, `price_version_id` (FK price.id), `quantity_thousandths`, plus the tax snapshot columns the same way sale lines do (`sales.ts`). The delivery fee is its own standard-rated line kind (`kind: 'product'|'delivery'`).
- **`stock_hold`**: `branch_id`, `product_id`, `order_id`, `quantity_thousandths`, `expires_at`, `released_at`, `release_reason` (`expired|cancelled|fulfilled`). Index `(org_id, branch_id, product_id) WHERE released_at IS NULL`.
- Add the new tables to the schema-inventory test and the tenant sweep table list.

## Slice 2 · Cart pricing = till pricing (commit 3)

`packages/core/src/storefront/cart.ts` holds `quoteCart(db, orgId, raw, now)`:

1. Valibot input: branch, lines of `{productId, quantityThousandths}` (max 100 lines), fulfilment and slot are optional.
2. Read the basket's products from `catalogue_public` and `product`, their `price` rows, the `tax_rule` rows and the org's `priceMode` / `vatRegisteredFrom`. Shape them with the existing projections in `packages/core/src/changes/project.ts` (`priceUpsert`, `taxRulePayload`).
3. Call the till's own **`quoteFrom`** from `packages/core/src/till/quotation.ts` per line, so it is the same code and not a copy. Sum the totals with `@shopper/money` `add`, the same way `quoteDraft` in `till/drafts/quote.ts` does. There is no cash rounding, because an online order is never cash.
4. Return per-line `{price, priceId, tax snapshot, available}`. Lines that are unavailable or unpriced come back flagged and are left out of the totals. Delivery adds a fee line through `snapshotAmount` (inclusive, standard class).

If `quoteFrom` drags SQLite imports into the server bundle, move `quoteFrom`, `effectivePrice` and `ghanaDate` to `packages/core/src/tax/quote.ts`. The till keeps importing them from there.

**Availability** becomes `onHand − active holds` in one place. Add `availableOf` beside `onHandOf` in `packages/core/src/stock/onhand.ts`. `listStoreProducts` and `readStoreProduct` switch to it, so a held last unit disappears from the store.

**Tests**, in `tests/integration/shop/cart.test.ts`, written first:

- **The cart total equals the till total**: provision a till reference for the same org through the existing till fixture, `quoteDraft` a basket, and assert that `quoteCart` gives an equal total and equal per-line snapshots. Cover inclusive and exclusive price modes, a branch price override and a weighed quantity.
- A product without a price, or out of stock, comes back unavailable and is left out of the totals.
- A delivery fee line adds VAT and levies when the seller is registered and none when it is not.

## Slice 3 · StockHold port, DO, box twin, conformance (commit 4)

**Port**, in `packages/ports/src/types.ts`:

```ts
interface StockHolds {
  // Reserves every line or none; refuses when available < wanted. PG is the record.
  hold(
    orgId,
    branchId,
    orderId,
    lines,
    expiresAt,
  ): Promise<{ ok: true } | { ok: false; short: string[] }>;
  release(orgId, branchId, orderId, reason): Promise<void>;
}
```

**Core**, in `packages/core/src/orders/holds.ts`:

- `reserveStock(tx, …)` takes `pg_advisory_xact_lock(hash(org, branch))`, reads `availableOf` for each line, inserts the `stock_hold` rows and writes an audit row. That lock is the real guarantee on both runtimes.
- `releaseHolds(db, …)` sets `released_at` idempotently.
- `expireHolds(db, org, branch, now)` releases every hold past `expires_at` and marks those orders `expired`.

**CF**, in `packages/adapters/cf/src/holds.ts`:

- `StockHold extends DurableObject` (already one of the five approved DOs), with one address per `${org}/${branch}`.
- `hold()` runs the core transaction through Hyperdrive, then sets `ctx.storage.setAlarm(earliest expiry)`.
- `alarm()` calls `expireHolds` and re-arms for the next expiry. It keeps no second copy of the state, only a SQLite "next expiry" row.
- Add the binding and migration (`new_sqlite_classes`) to `apps/edge/cloudflare.config.ts` and export it from `apps/edge/src/index.ts`.

**Box**, in `packages/adapters/box/src/holds.ts`:

- The same core calls, with an in-process timer per branch for the next expiry.
- On box start, sweep `expireHolds` once so a restart never strands a hold.
- Shortcut comment: Rivet actor on day 36, matching `box/src/workflows/price.ts`.

**Conformance**, in `packages/conformance/src/cases/holds.ts`, run against both adapters:

- all-or-nothing;
- a refused short line;
- release is idempotent;
- an expired hold is released by the alarm/timer (use a short expiry).

**Integration**, in `tests/integration/shop/holds.test.ts`:

- **The reservation prevents overselling the last unit.** With one unit on hand, two concurrent `placeOrder` calls give exactly one success and one "sold out". The store then hides the product.
- If the till sells the last unit first (accept a synced sale through the existing sale fixture), the online checkout is refused.
- A hold that has expired gives the unit back.

The plan doc must say this plainly: an offline till can still sell a held unit. The hold stops the online side from overselling, and the conflict shows when the till syncs. That is the limit of offline-first, not a bug to fix today.

## Slice 4 · Online order workflow skeleton (commit 5)

`packages/core/src/workflows/order.ts` holds `runOnlineOrder(flow, deps, params)`. The instance id is `online-order_${org}_${orderId}`, the same pattern as `priceChangeId`. Steps:

1. `hold`: confirm the hold rows exist (written at placement) and checkpoint `workflow_run`.
2. `payment`: `flow.waitFor("payment", "payment.settled", until hold_expires_at)`. Day 33 starts the child Payment workflow and sends this event. On `WorkflowTimeoutError`, release the holds, set the order `expired` and close the run as completed.
3. `accept`: `flow.waitFor("accept", "store.accepted", …)`. The skeleton only reaches this once a payment event arrives, and a test sends a fake one.

Every step writes its table, an audit row and `workflow_run` in one transaction, following `workflows/price.ts`. Shells go in `packages/adapters/cf/src/workflows/order.ts` (a WorkflowEntrypoint like `price.ts`) and `packages/adapters/box/src/workflows/order.ts` (memoryWorkflow, with the same shortcut comment). Register the binding in the edge config.

Tests, in `tests/integration/workflows/order.test.ts`, use memoryWorkflow:

- with no payment, the hold expires, the order is `expired` and the stock comes back;
- a sent `payment.settled` advances the run to waiting on `store.accepted`;
- `workflow_run` mirrors each step.

## Slice 5 · Place order API (commit 6)

Core: `packages/core/src/orders/place.ts` defines a `defineCommand("order.place")` that runs in one transaction:

1. validate the fulfilment and slot against `branch_fulfilment`. The slot must be open, inside opening hours, after the lead time and under capacity, counting non-expired orders in that slot;
2. `quoteCart`;
3. reserve the stock;
4. insert the order and its lines with `price_version_id`;
5. take `inbox_cursor` from `Sequencer.next(org, store)`;
6. launch the workflow inside the transaction, the same pattern as `schedulePrice`;
7. write the audit row (`redact()` masks the phone by key name).

There is **no journal entry**, because nothing has been paid. Day 33 posts at payment.

Slots: `listSlots(db, org, branch, now)` returns the next 3 days of slots with how many places remain.

API in `packages/api/src/routes/shop/orders.ts`, mounted with the store routes:

- `GET /shop/:code/branches/:id/fulfilment`: options and slots, public and short-cached.
- `POST /shop/:code/cart/quote`: public, rate-limited on `public`.
- `POST /shop/:code/orders`: public guest checkout. Turnstile through the existing shop verifier, a new `checkout` rate policy (5 / 60 s per IP) in `packages/ports/src/limits.ts` and the edge bindings, and an idempotency key so a double-click places one order. If a shop session exists, the account is linked and the name and phone are pre-filled.
- `GET /shop/:code/orders/:id?t=token`: the confirmation, matched on `sha256(token)` via `@shopper/utils`, 404 otherwise.

Security:

- Add the routes to the tenant sweep `PUBLIC` handling (shop routes take the org from the code, never from the body).
- Add bodies to `tests/support/security/bodies.ts`.
- Update the security.md routes table.

Tests, in `tests/integration/shop/orders.test.ts`:

- **a guest places an unpaid order**: status `placed`, the hold exists, the lines carry `price_version_id` and `channel = 'online'`, the cursor increases per store, and there is an audit row with the phone masked;
- a full slot, a closed branch and delivery while delivery is off are each refused;
- the idempotency key gives one order;
- a wrong token gives 404;
- a price that changed between quote and place: the order takes the price at placement and says so.

## Slice 6 · Back office: branch fulfilment settings (commit 7)

- In `packages/backoffice/src/components/branches/`, add a `fulfilment/form.tsx` section on the branch screen (Dashboard 27:2031 settings layout, `@shopper/ui` form parts).
- Query and mutation go in `queries/branches/fulfilment.ts`, through `PUT /branches/:id/fulfilment` (`branch.write`, `defineCommand`, audit) in `packages/api/src/routes`.
- Design every state: loading skeleton, saved, validation errors such as closes ≤ opens, and no permission.
- Tests:
  - integration for the route: permission, audit and tenant sweep;
  - e2e: an owner turns delivery on and sets a fee.

## Slice 7 · Shop UI: cart, checkout, confirmation (commit 8–9)

- **Cart state**: in `apps/shop/src/stores/cart.ts`, a localStorage-backed external store (`useSyncExternalStore`, no effects, guarded `try`) keyed by shop and branch. Switching branch keeps the lines and re-quotes them.
- **Add to cart** on the product page and the tile (quantity stepper; weighed items in kg steps). The header gets a cart button with a count badge and the shortcut `c`.
- **`/$shop/cart`** follows the Web Flow "Checkout" frame:
  - numbered lines, a qty stepper, remove, Clear cart (with confirmation), and the server-quoted Total with an item count and a tax breakdown;
  - unavailable lines are flagged with a "Remove" action;
  - the loader quotes through `POST cart/quote`.
- **`/$shop/checkout`**:
  - a pickup/delivery toggle (only what the branch offers), slot chips grouped by day with the places remaining, and an address form for delivery;
  - name and phone (New Login 173:3087 field states), the delivery fee line, a total re-quoted on change, Turnstile, and "Place order";
  - errors: slot just filled, item sold out (back to the cart with that line flagged), rate limited.
- **`/$shop/orders/$id`**: confirmation with the order number, the slot, the lines and the totals. The status reads "Awaiting payment — pay before HH:MM to keep your items" (payment arrives on Day 33).
- Every state, keyboard path and `aria` live region for the total. Skeletons are measured with `/skeleton-audit`.
- e2e in `tests/e2e/shop/checkout.spec.ts`: add two items → cart total matches → checkout pickup → confirmation shows "Awaiting payment". A sold-out race shows the flagged line.
- `/ui-verify` at desktop 1920, laptop 1440, tablet 768 and mobile 390 (till size is not relevant, but it is listed as checked). Screenshots go to `docs/plans/day32/screenshots/`, along with the console and overflow checks.

## Slice 8 · Docs + verification (commit 10)

- Write `docs/plans/day32/plan.md` (this plan) and `docs/plans/day32/verification.md` (commands run, results and the open issues list).
- Update:
  - `docs/engineering/architecture.md`: the StockHold DO, the order workflow and availability = on hand − holds;
  - `platforms.md`: the DO binding and the alarm;
  - `security.md`: the checkout route, token, Turnstile and rate policy;
  - `frontend.md`: the cart store and the "General ledger" rename.

## Critical files

- **New**:
  - `packages/db/pg/migrations/0038_orders.sql`, `packages/db/pg/src/schemas/orders/*`;
  - `packages/core/src/{orders/*,storefront/cart.ts,workflows/order.ts}`;
  - `packages/adapters/{cf,box}/src/holds.ts` and the `workflows/order.ts` shells;
  - `packages/conformance/src/cases/holds.ts`;
  - `packages/api/src/routes/shop/orders.ts`;
  - the new `apps/shop/src` routes, components and stores.
- **Changed**:
  - `packages/ports/src/{types,limits}.ts`, `packages/core/src/stock/onhand.ts`, `packages/core/src/storefront/catalogue.ts`;
  - `apps/edge/cloudflare.config.ts`, `apps/edge/src/index.ts`;
  - the box runtime wiring, `packages/backoffice/src/lib/shell/nav/items.ts`, `components/branches/*`;
  - `tests/integration/security/tenant/sweep.test.ts`, `tests/support/security/bodies.ts`.
- **Reused, not rewritten**:
  - `quoteFrom` / `effectivePrice` (`core/src/till/quotation.ts`) and `snapshotLine` / `snapshotAmount` (`@shopper/tax`);
  - `onHandOf`, `priceUpsert` / `taxRulePayload` (`core/src/changes/project.ts`);
  - `defineCommand`, `redact`, `Sequencer.next`, memoryWorkflow, the shop Turnstile verifier;
  - the `schedulePrice` launch-in-transaction pattern and the `FiscalLane` alarm pattern.

## Verification

1. `vp run services:up`, `vp run db:migrate` (reset the dev DB if needed; data is disposable), `vp run db:seed`.
2. Per slice: the new tests fail first, then pass. Break the change once on purpose and watch it fail. Run `vp check`, `vp run guard`, the touched suites, and `vp test --run` before the final push.
3. Conformance: the holds case passes on both the cf (miniflare/edge test) and box adapters.
4. Real browser (`playwright-cli`):
   - a guest browses the store → adds to cart → checks out with pickup → sees confirmation;
   - a second browser on the last unit gets "sold out";
   - the owner sees "General ledger" in the sidebar and sets branch fulfilment;
   - screenshots at the 4 sizes, a keyboard-only pass, no console errors, no horizontal overflow at 390.
5. `pre-merge-review` with the Codex `gpt-6.1-sol` review, fix the findings, then push → PR → CI green (auto-fix failures) → merge → update Notion.

## Out of scope today (named, not built)

- The real payment and its child workflow, plus payment journal entries: Day 33.
- The store's order inbox UI and accept/pick/fulfil: later days.
- Delivery zones and distance pricing.
- Durable box holds on Rivet: day 36.
