# Day 16: inventory

## Context

The Notion goal for Day 16 · Inventory (Tue 20 Oct, API + Portal) is "stock the owner can trust."

**Tasks:**

- Goods received notes (GRN) against suppliers, with cost.
- Adjustments with reasons, including wastage.
- Full and partial stock takes: a count sheet, then the variance is posted.
- Stock on hand folded from `stock_movement`, never a mutable number.
- Reorder points, with a low-stock SMS through Arkesel via the `Queue` port.
- A valuation report.
- Portal inventory screens for the inventory manager role.

**Required tests (names verbatim):**

- "Receive → sell → count → variance; stock on hand equals the fold of movements"
- "Low-stock alert enqueued once, not once per sale"

**Done when:** the inventory manager can run a stock take from the portal.

**Precondition (owner):** Day 15 is finished first. That means slice 9 committed, plus its wrap-up, review and Notion update. Day 16 then branches `day16-inventory` from the Day 15 tip, or from `origin/main` if Day 15 has merged by then.

### What already exists (reuse, don't rebuild)

**Stock ledger and documents**

- PG `stock_movement` (`packages/db/pg/src/schemas/stock.ts`) is a signed ledger. Its reasons are sale, adjustment, return, count and receipt. Nothing writes `adjustment` yet.
- `stock_document` covers till counts and receipts only. `device_id` is NOT NULL, and receipts have no cost.
- `packages/core/src/stock/accept.ts` already folds on-hand with SUM. Its count delta is `counted − on hand at countedAt`, and it raises `SUPERSEDED`.

**Sales and refunds**

- `sales/accept.ts:~121` and `refunds/accept.ts:~129` write movements in the same transaction as the sale or refund.

**Catalogue**

- The `supplier` table exists (`catalogue.ts:76`), and `product.supplierId` exists.

**Commands and API**

- `defineCommand` (`packages/audit/src/define/command.ts`) handles the transaction, the org lock, replay and the audit row. It already has one hook that runs after commit (`onStoreChanged`).
- Patterns to follow: `core/catalogue/products/{commands,queries}.ts` (cursor `listQuery`), `api/routes/{catalogue,shifts}.ts`.

**Queue**

- The `Queue` port (`packages/ports/src/types.ts`) is a contract only: no adapter, no conformance case.
- Both Workers already declare a `NOTIFICATIONS` queue binding.
- Box workflows are `memoryWorkflow`. Rivet arrives on Day 36.

**Roles**

- The `inventory` role already holds `product.read`, `stock.read`, `stock.write` and `product.propose`. It is the inventory manager; only its label changes.
- There are 32 permission codes, and the role matrix e2e test expects 32.

**Backoffice**

- The till-register stock screens (`screens/stock/{inventory,count,receiving}`, `components/stock/document/*`) stay as they are. The portal reuses their product search and line editor.

### Owner decisions

- Valuation = on hand × the **last received unit cost**, per product per branch.
- Low-stock SMS goes to **branch alert phones**, up to 3 per branch, set in the portal.
- A **reorder point is per product per branch**.
- **Data is disposable.** Resets and wipes are fine, and there is no backfill.
- **Codex is unavailable.** The `reviewer` agent and the `pre-merge-review` skill review in this session.
- **One commit per slice, one push at the end.** `.claude/settings.json` is never staged.
- **No AI attribution** in commits or PRs.
- **Figma is read-only.**

### Defaults taken (override at approval)

1. **Portal stock records** reuse `stock_document`.
   - `device_id` becomes nullable.
   - New kind `adjustment`, plus `supplier_id` and `cause` columns.
   - Adjustments use the existing `adjustment` movement reason.
   - Wastage is an adjustment with cause `damaged` or `expired`.
   - Causes: `damaged`, `expired` and `theft` remove stock; `found` adds; `other` goes either way. The sign is enforced by Valibot.
   - Corrections are done with a stock take.
2. **Cost.** A receipt line carries a unit cost per base unit, stored as Money in a new `stock_movement.unit_cost` column (receipts only).
   - Line total = `mulQty`.
   - Till receipts stay cost-less, so the till sync contract and protocol are unchanged.
3. **Supplier and date.** A portal receipt requires a supplier. The server dates every portal record through an injected `now`; there is no backdating.
4. **Stock take scope.** A take is either **full** (every active product) or **one category**.
   - One open take per branch, enforced by a unique partial index. A take can be cancelled.
   - Variance = counted − on hand at that line's `countedAt`, the same rule as the till count. Sales continue during a take.
   - Posting is refused while any line is uncounted (`NOT_COUNTED`).
   - A newer till count gives `SUPERSEDED` until that line is recounted.
5. **Alerts.**
   - A `stock_alert` row is raised in the writer's transaction when on hand ≤ the level.
   - Unique partial index `(org, branch, product) WHERE cleared_at IS NULL`, so there is one alert per crossing.
   - The alert clears when on hand goes back above the level.
   - The message is sent **after commit** by `defineCommand`, the same way as `onStoreChanged`.
6. **Permissions: none new.** The role matrix stays at 32.
   - `/stock/**` reads need `stock.read`; writes need `stock.write`.
   - Valuation needs `stock.read` (not `report.read`, which also unlocks the till X-report).
   - Supplier writes move from `product.write` to `stock.write`.
   - Alert phones are a branch field, so they need `branch.write`.
7. **No new package.**
   - The Arkesel client goes in `packages/core/src/sms/arkesel.ts`, following the Paystack precedent.
   - The backoffice uses the existing workspace `uuid` for client-generated UUIDv7 record ids, so a retried submit replays instead of doubling stock.
8. **Valuation flags.**
   - On hand ≤ 0 is valued at 0; below zero it is flagged "Negative stock".
   - A product with no costed receipt is flagged "No cost".
   - No CSV export.
9. **Queue port: drop `consume()`** and add a `QueueHandler`. Cloudflare pushes batches to the Worker's `queue()` export, so a pull-style `consume` can't be implemented there. Nothing uses the port today.

**Open but not blocking:** the Arkesel sender ID (≤ 11 chars, e.g. "Shopper") and the API key. Tests use a fake. Staging SMS stays off until `ARKESEL_API_KEY` and `ARKESEL_SENDER` are set with `cf secret`.

## Data model: migration `0024_inventory`

Generated by drizzle-kit; journal `when` = 1792231200008.

**`stock_document`**

- `device_id` becomes nullable.
- New columns: `supplier_id` (foreign key `(org, supplier)`) and `cause`.
- Checks:
  - kind is one of count, receipt, adjustment
  - `(kind = 'adjustment') = (cause IS NOT NULL)`
  - cause is one of damaged, expired, theft, found, other
  - a receipt has a `device_id` or a `supplier_id`
- New index on `(org, branch, kind, occurred_at)`.

**`stock_movement`**

- New `unit_cost` money column, nullable.
- Check: `unit_cost IS NULL OR (reason = 'receipt' AND unit_cost >= 0)`.

**`branch`**

- New `alert_phones text[] NOT NULL DEFAULT '{}'`.
- Check: `cardinality ≤ 3`.

**New `schemas/stock/reorder.ts`**

- `reorder_point`: unique `(org, branch, product)`, `level_thousandths ≥ 0`.
- `stock_alert`: level, on hand, `raised_at`, `cleared_at`, `sent_at`. Unique partial index `stock_alert_open`.

**New `schemas/stock/takes.ts`**

- `stock_take`:
  - `scope` is full or category, with a check tying `category_id` to the scope.
  - `status` is open, posted or cancelled.
  - Who started it and who closed it.
  - Unique partial index on `(org, branch) WHERE status = 'open'`.
- `stock_take_line`:
  - Counted quantity, counted at, counted by, and the expected quantity (stored at post).
  - Unique `(take, product)`.
  - The three counted columns are all null or all set.

Every table has `org_id`, UUIDv7 ids and composite `(org, x)` foreign keys.

## Core: `packages/core/src/stock/` (via `@shopper/core/stock`)

**Shared reads**

- `onhand.ts`: `onHand(tx, orgId, branchId, items: {productId, at?}[])`. One `unnest`-join SUM, chunked. It is the only way on-hand is read.
- `counts.ts`: `countDeltas(...)`, which is the SUPERSEDED check plus the delta, extracted from `accept.ts`. That file shrinks, and `tests/integration/sync/stock/*` must stay green.

**Writers**

- `record.ts`: `stock.receipt.record` (`receiveStock`) and `stock.adjustment.record` (`adjustStock`), both through a shared `recordDocument`. A replay matches on id plus content hash.
- `reorder.ts`:
  - `checkReorder(tx, ctx, branchId, productIds)` returns early when no levels are set.
  - It raises with `ON CONFLICT DO NOTHING RETURNING` followed by `enqueueAfterCommit`, and clears with an UPDATE.
  - Command `stock.reorder.set`.
- `checkReorder` is called from every writer: `sales/accept.ts`, `refunds/accept.ts`, `stock/accept.ts`, `record.ts`, `takes/post.ts` and `reorder.ts`.

**Stock takes**

- `takes/commands.ts`: `stock.take.start` (product snapshot inserted in chunks), `stock.take.count` (1 to 500 lines), `stock.take.cancel`.
- `takes/post.ts`: `stock.take.post`.
  1. Lock the take `FOR UPDATE`.
  2. Check every line is counted (`NOT_COUNTED`).
  3. Run `countDeltas` at each line's `countedAt`.
  4. Write a count record whose id equals the take id.
  5. Write the movements, dated at each line's `countedAt`.
  6. Store the expected quantities, mark the take posted, and run `checkReorder`.
- `takes/queries.ts`: `listTakes` and `readTake`. An open take computes expected and variance live; a posted one reads the stored values.

**Reads, valuation and alerts**

- `queries.ts`: `stockBranches`, `listStock`, `readStockProduct` (running balance via `SUM() OVER`), `listDocuments`, `readDocument`.
- `valuation.ts`: `lastCosts` (a `DISTINCT ON … unit_cost IS NOT NULL` query) and `stockValuation`, using `mulQty` and `add` only.
- `alerts/deliver.ts`: `deliverStockAlert(db, sms, delivery, appVersion)`.
  - It acks without sending when the alert is cleared, already sent, or the branch has no phones.
  - Otherwise it sends, then runs the audited `stock.alert.sent` (`WHERE sent_at IS NULL`), then acks.
  - If anything throws, it calls `retry()`.

**Errors and schemas**

- New `StockError` codes: `NOT_FOUND`, `NOT_COUNTED`, `TAKE_OPEN`, `TAKE_CLOSED`, `INVALID_SIGN`.
- `schemas/stock/{portal,takes,alerts,views}.ts`. `alerts.ts` holds `stockAlertMessage` and `NOTIFICATION_RETRY = {maxAttempts: 6, delayMs: 60_000}`.
- `ghanaPhone` moves from `payments/schemas/momo.ts` to `schemas/fields.ts`. `branchInput` and `branchPatch` gain `alertPhones` (at most 3, unique).

**Arkesel client** (`sms/arkesel.ts`)

- `createArkesel({apiKey, sender, baseUrl, fetch})`.
- POSTs to `/api/v2/sms/send` with the `api-key` header and a 10 s timeout, converting `0…` numbers to `233…`.
- A failed reply throws `ArkeselError`.
- The reply schema lives in `sms/schemas/arkesel.ts`.

**Audit: sending after commit**

- `enqueueAfterCommit(tx, envelope)` goes next to `notifyStoreChanged`.
- `defineCommand` must capture `context.queue` **before** `v.parse`, because the parse strips unknown keys. After commit it calls `send` and logs `queue.send_failed` on failure.
- The queue is passed as `notifications?: Queue` through `acceptSale`, `acceptRefund`, `acceptStockDocument`, `createSyncRoutes`, `ApiOptions`, `RuntimeOptions` and `serveRuntime`.

## API: `packages/api/src/routes/stock.ts` and `routes/stock/takes.ts`

`GET` needs `stock.read`; anything else needs `stock.write`. Device principals are forced to their own branch.

**Stock and records**

- `GET /stock/branches`
- `GET /stock?branchId&q&categoryId&low&cursor&limit`
- `GET /stock/products/:productId?branchId`
- `PUT /stock/reorder`
- `GET /stock/documents?branchId&kind`: each record carries its `reference` and, for a receipt, `totalCost` (the sum of its costed lines, in `@shopper/money`); the page also carries `counts` of every kind at the branch, for the Records segments.
- `GET /stock/documents/:id`: lines carry the product's `baseUnit`.
- `POST /stock/receipts` (201; a replay returns 200)
- `POST /stock/adjustments`
- `GET /stock/valuation?branchId`: lines carry the product's `baseUnit`, so the report can say "15 kg".

**Stock takes**

- `GET /stock/takes`
- `POST /stock/takes`
- `GET /stock/takes/:id`
- `PUT /stock/takes/:id/counts`
- `POST /stock/takes/:id/post`
- `POST /stock/takes/:id/cancel`

**Other API edits**

- `routes/catalogue.ts`: the supplier write guard becomes `stock.write`.
- `problem.ts` maps `StockError`: 409 for conflict, superseded, not counted, take open and take closed; 400 for an invalid reference or sign; 404 for not found. The body also carries `code` (the `StockError` code), so the portal tells TAKE_OPEN from NOT_COUNTED without reading the words.
- `app.ts` mounts both route files.
- **`runtime.ts`: add `stock` to the `isPublicRequest` regex.** Without it, `/stock` falls through to the public API.

## Queue port and adapters

Load the `cloud-box-parity` and `workers-best-practices` skills, and check Queues config with `cf docs search` before writing.

**Port**

- `Queue` becomes `{ policy; send }`, plus a `QueueHandler` type.
- `packages/conformance/src/cases/queue.ts` gets the cases, with a `QueueFixture` type `(handler) => {queue, settle}`.

**Box: `packages/adapters/box/src/queue.ts`**

- `boxQueue(policy, handler)` validates with `messageBody` and delivers in-process with timed retries.
- A handler that returns without acking is retried. After `maxAttempts` it logs `queue.dead_letter`.
- `ponytail:` messages are lost if the box restarts. The Rivet queue replaces this on Day 36.

**Cloudflare: `packages/adapters/cf/src/queue.ts`**

- `cloudflareQueue(binding)` is the producer.
- `cloudflareDeliver(batch, handler)` explicitly retries any message the handler neither acked nor retried, so Cloudflare never acks one silently.
- `cloudflareNotifications(batch, env)` is the consumer shell, about 20 lines.

**Edge Worker**

- `apps/edge/worker.ts` exports `{fetch, queue}`.
- `cloudflare.config.ts` gets a consumer trigger: dead-letter queue `shopper-notifications-dlq-${stage}`, `maxRetries` 5, `retryDelay` 60, batch size 10.
- Add the `ARKESEL_API_KEY` secret and an `ARKESEL_SENDER` text binding.

**Portal Worker:** gets the secret too, so it can enqueue. The edge Worker is the only consumer.

**Box app** (`apps/box/src/app.ts`): builds the queue only when `ARKESEL_API_KEY` is set.

**Arkesel fake:** `tooling/arkesel/server.ts`, with an api-key check, recorded requests and `failNext(n)`.

## UI: `@shopper/backoffice`, portal context `inventory/`

The portal code stays separate from the till's `stock/` screens.

**Figma** (file `4MtEIWv8yBUBYgkrk4ubPk`, read-only). It has no inventory frames, so the screens are composed from:

- 45:852 "Previous purchases": search, segments with counts, table with status badges.
- "Purchase #10482": items table and summary cards.
- 227:4900: tab nav and the "Inventory Management" action.
- 12:66: input style.

**Routes** (`routes/inventory.tsx`)

- `/stock`
- `/stock/products/$productId`
- `/stock/records?kind=`
- `/stock/records/$documentId`
- `/stock/receive`
- `/stock/adjust`
- `/stock/takes`
- `/stock/takes/$takeId` (count sheet)
- `/stock/valuation`
- `/suppliers`

**Nav entries:**

- Stock, Stock records, Stock takes and Valuation, each gated by `stock.read`.
- Suppliers, gated by `product.read`.
- The role label becomes "Inventory manager".

**Files**

- Queries: `queries/inventory/{stock,records,takes,valuation}.ts` and `queries/suppliers.ts`. Every key includes the shop id.
- Screens: `screens/inventory/{stock/list,stock/product,records/list,records/detail,receive,adjust,takes/list,takes/sheet,valuation}/screen.tsx` and `screens/suppliers/screen.tsx`.
- Components: `components/inventory/*` and `components/suppliers/{table,form}.tsx`.
- Count sheet rows are virtualized above 100 rows.
- `ProductSearch` gains a `query` prop.
- The branch form gets three alert-phone inputs.

**States:** every screen has a skeleton (checked with `/skeleton-audit`), an empty state with the next action, an error state with retry, an offline note with writes disabled, and a `Gate` for no permission.

**Shortcuts** (each shown on its button):

- Stock list: `/` search, L low stock, B branch.
- Product stock: E edit the reorder point.
- Stock records: R receive, A adjust.
- Forms: Mod+Enter save, Esc back.
- Stock takes: N start a take.
- Count sheet: Enter save and next, U uncounted only, Mod+Enter review then post.

**Bug fix:** `@shopper/utils` `formatQuantity` renders −1 500 as "-1.-5". Put the sign first; the take e2e test asserts "−1.5".

## Tests (written first by `test-author`; PG18 fixture, `goldenWorld()`, `portalOwner`/`portalMember`, fake Date)

**`tests/integration/stock/ledger.test.ts`**

**"Receive → sell → count → variance; stock on hand equals the fold of movements"**

- **08:00, receive.** Inventory member records a receipt: Rice 24 000 @ 95 000, Tomatoes 10 500 @ 280 000.
- **Golden sales.** Rice drops by 3.
- **14:00, count.** Full take; count Rice 20 000. Before posting it shows expected 21 000, variance −1 000, value −95 000.
- **14:30.** One more Rice sale.
- **15:00, post.** Variance is still −1 000, and on hand is 19 000.
- **The fold.** For every product, `GET /stock` on hand = a SQL `SUM … GROUP BY` = the detail page's last running balance.
- **Audit.** Commands are present and `verifyChain` passes.
- Posting a second time returns 409.

**`tests/integration/stock/alerts.test.ts`**

- **"Low-stock alert enqueued once, not once per sale"**
  - Receive 5 000, then set the level to 3 000.
  - Four sales take on hand to 1. Exactly one `stock.low` v1 message is sent, and one alert is open.
  - Receiving clears it; there is still 1 message.
  - Raising the level gives 2 messages and 2 alert rows.
- **"Every stock writer raises or clears the alert"** is table-driven over: till count, till receipt, refund, wastage, take post, setting a level, deleting a level.
- **"A rolled-back writer enqueues nothing"**

**`tests/integration/stock/sms.test.ts`** (Arkesel fake)

- **One SMS:** sent with recipients normalized to `233…`, with `sent_at` and audit row `stock.alert.sent`. Redelivery sends nothing.
- **Retry:** a failure is followed by a successful retry. When retries run out, the message dead-letters and `sent_at` stays null.
- **Nothing to send:** a cleared alert or a branch with no phones sends nothing.
- **Phone validation:** bad numbers or more than three return 400; a cashier gets 403.

**`receiving.test.ts`**

- Validation: missing supplier, quantity 0, cost below 0, no lines, a repeated product. Another org's supplier returns 409.
- Replay by id; the same id with different content returns 409.
- The last costed receipt sets the unit cost, and a cost-less till receipt doesn't change it.
- Role gates: inventory can write; cashier and accountant cannot.

**`adjustments.test.ts`**

- Wastage removes stock with its cause; found stock adds it.
- The sign must match the cause.

**`takes.test.ts`**

- A full take lists every active product and refuses to post (`NOT_COUNTED`).
- A category take lists only that category.
- One open take per branch.
- A newer till count gives SUPERSEDED until the line is recounted.
- A recount replaces the count, its time and its counter.

**`valuation.test.ts`**

| Product         | On hand | Unit cost | Value     | Flag           |
| --------------- | ------- | --------- | --------- | -------------- |
| Rice            | 15 000  | 100 000   | 1 500 000 |                |
| Tomatoes        | 2 500   | 280 000   | 700 000   |                |
| Rounding case   | 333     | 10 001    | 3 330     |                |
| No-cost product |         | none      | 0         | No cost        |
| Negative stock  | −1 000  |           | 0         | Negative stock |

- Total 2 203 330. Other branches are excluded.

**`list.test.ts`**

- Paging, search and the `low=1` filter.
- Another org's branch returns 404.
- Running balance newest first.

**`api/stock.test.ts`** checks 401 and the read and write gates. `api/runtime.test.ts` gets "stock paths reach the tenant API".

**Queue conformance** (`packages/conformance/src/cases/queue.ts`)

- Runs on the box (`tests/integration/ports/queue.test.ts`) and on Workers (`tooling/worker/tests/queue.test.ts`, `createMessageBatch`/`getQueueResult`).
- Cases:
  - An invalid envelope and one over 96 KB are rejected.
  - A message without an ack is redelivered with attempts + 1.
  - A handler that throws is redelivered.
  - Box only: dead-letters after `maxAttempts`.
  - Workers only: the edge handler texts a raised alert.
- `tooling/cloudflare/edge.test.ts` checks the consumer, the dead-letter queue and the secret.

**End-to-end** (`tests/e2e/portal/stock/`, with axe and screenshots)

- **`take.spec.ts`, "The inventory manager runs a stock take from the portal"** (Done-when), keyboard only:
  - N starts a take, then Full and Enter.
  - Enter moves through the counts; U shows uncounted lines only.
  - Mod+Enter opens the review, which shows "−1"; Mod+Enter again posts, and on hand updates.
  - Also covers the empty, loading, error, offline and no-permission states.
- **`receiving.spec.ts`**: inline supplier, product search, quantity and cost, Mod+Enter, then the detail.
- **`adjust.spec.ts`**: wastage.
- **`stock.spec.ts`**: search, the low filter, product detail, E edits the reorder point, valuation.
- **`suppliers.spec.ts`**.
- **Branch alert phones** get a case in `tests/e2e/portal/branches/`.

## Slices: one commit each, `reviewer` before each commit, `checker` for checks

| #   | Slice                                                                                                                        | Tests first                               | Builder / skills                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------- |
| 0   | Plan saved to `docs/plans/day16/plan.md`                                                                                     | –                                         | main                                                                            |
| 1   | Inventory schema (0024) and stock on hand API: `onhand`, `counts` refactor, queries, GET routes, runtime regex, `problem.ts` | `list`, `api/stock` reads, runtime case   | `implementer` via `/tdd-slice`                                                  |
| 2   | Goods received with supplier and cost, valuation                                                                             | `receiving`, `valuation`                  | `implementer`                                                                   |
| 3   | Stock adjustments and wastage                                                                                                | `adjustments`                             | `implementer`                                                                   |
| 4   | Full and category stock takes with variance posting                                                                          | `takes`, `ledger` (Notion test 1)         | `implementer`                                                                   |
| 5   | Queue port on Cloudflare Queues and the box                                                                                  | conformance `queue`, box and Workers runs | `implementer` + `/cloud-box-parity`, `workers-best-practices`, `cf docs search` |
| 6   | Reorder points and low-stock alerts enqueued once                                                                            | `alerts` (Notion test 2)                  | `implementer`                                                                   |
| 7   | Low-stock SMS through Arkesel on both platforms                                                                              | `sms`, Workers handler, `edge.test`       | `implementer` + `/cloud-box-parity`                                             |
| 8   | Portal stock on hand, reorder points, suppliers, branch alert phones                                                         | `stock.spec`, `suppliers.spec`, branches  | `ui-builder` + `/ui-screen`, `/ui-verify` (playwright-cli), `/skeleton-audit`   |
| 9   | Portal goods received, adjustments, stock records                                                                            | `receiving.spec`, `adjust.spec`           | `ui-builder` + same skills                                                      |
| 10  | Portal stock takes and valuation, plus the `formatQuantity` fix                                                              | `take.spec` (Done-when)                   | `ui-builder` + same skills                                                      |
| 11  | Wrap-up                                                                                                                      | full suite                                | see below                                                                       |

**Slice 11 wrap-up:**

1. Run `vp test --run`, `vp run e2e` and the Workers suite.
2. Review with `ui-reviewer` and `/pre-merge-review` (the reviewer agent, since Codex is out).
3. Update docs:
   - `architecture.md`: Inventory section.
   - `platforms.md`: Queue consumer, explicit ack, the dead-letter queue, the box memory queue until Day 36, and Arkesel.
   - `testing.md`: Day 16 helpers and the Arkesel fake.
   - `deployment.md`: migration 0024, creating the queue and dead-letter queue, `cf secret` for Arkesel.
   - `developer-experience.md`: the `ARKESEL_*` variables.
4. Push once and open the PR.
5. Update the Notion Day 16 row: set Status to Done, tick the tasks and tests, and add completion remarks covering what shipped, verification counts, what was left out, and the upgrade notes (migration 0024, queue and dead-letter queue creation, Arkesel secrets, reset dev data).

Commit messages follow the house style: "Day 16 slice N: …". No AI attribution.

## Verification

**Every slice**

- New tests fail first for the right reason, then pass.
- `vp check`, `vp run guard` and the area tests run through the `checker` agent.
- Each slice is broken once on purpose, and a test must catch it:
  - Slice 4: date count movements at post time; the 14:30 sale exposes it.
  - Slice 6: drop the partial index, or enqueue before commit. Expect 4 messages, or a message for a rolled-back write.
  - Slice 5: leave a Cloudflare message unacked; it must not be silently acked.

**Slices 5 and 7:** also `vp -C tooling/worker/tests exec vitest run`.

**UI slices**

- Run `vp run services:up`, `db:reset` and `db:seed`, then the real portal.
- `/ui-verify` with playwright-cli at 1920, 1440, 1366, 768 and 390 px, covering every state, the keyboard path, the console and overflow.
- Screenshots go to `docs/plans/day16/screenshots/portal/`, with remaining issues reported.

**End to end:** the inventory manager signs in, receives goods, sells on the till harness, runs a full stock take from the portal, posts it, sees the variance and valuation, and gets one low-stock alert in the Arkesel fake.

## Left out (add when…)

- **Lost sends.** A send lost after commit (a queue outage, or a box restart) is logged, and the alert shows as unsent. Re-sending moves into the daily watchdog once `Scheduler` is implemented; the Day 36 Rivet queue removes the box restart loss.
- **Not in this day:**
  - cost on till receipts
  - single-product takes in the portal
  - backdating
  - CSV export
  - as-of-date valuation
  - FIFO or average cost
  - wastage report
  - purchase orders
  - supplier returns
  - transfers between branches
- **On-hand rollup.** `ponytail:` the plain SUM fold is fine until one product's history reaches about 100k movements.
