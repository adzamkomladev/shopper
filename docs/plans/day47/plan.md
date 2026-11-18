# Day 47 — v1.5 · 2 · Publisher: catalogue projection

## Context

Notion row "v1.5 · 2 · Publisher: catalogue projection" (Box, Sync, P0). Day 46 shipped the cloud half of the
relay: `org.mode = 'relay'`, licence-signed `/relay/*` routes, a DB write-lock on the catalogue tables, and
`POST /relay/publish` (categories and products only). Nothing on the box calls it yet.

Day 47 builds the box half. A **Publisher** on the box pushes the shop's online catalogue to its relay org. The first
publish sends everything (the snapshot), then only what changed (deltas), in batches that are idempotent and
acknowledged. The box portal gets an Online Orders switch and per-category visibility (per-product
`online_visible` already exists). The relay stores what arrives.

**Done when:** a price change on the box shows on the relay org's online store within seconds.

Working rules, from the user and the memory file: no subagents. Opus medium does the work inline, tests first, one
commit per slice, push once at the end, then PR, CI watched until green (fix it if it fails), merge, and a Notion
update. Data is disposable, so migrations do not preserve data.

## Decisions

1. **The Publisher is a loop Workflow, not a sixth actor.** AGENTS.md allows only five DO/actor classes and treats a
   process that waits on time or events as a Workflow. It reuses the existing loop launcher
   (`launch(..., { loop: true })`, as `account`, `kyb` and `statements` do). A `start` on a running loop is a wake.
   Instance id = the org id.
   - Each run publishes until nothing is left, then ends. On a network or 5xx failure it records the error and waits
     60 s (`woken`, so a wake cuts the wait short), then tries again.
   - A 401, 402 or 403 from the relay (not enrolled, add-on off, maintenance lapsed) records the reason and ends the
     run. It does not retry.
2. **What changed is found by diffing hashes, not by reading a cursor into `store_change`.** The till feed is
   per-store and carries no categories and no `online_visible`, so a cursor would miss both.
   - The box keeps `relay_published (org_id, entity, entity_id, hash)`.
   - Each run builds the projection, sends rows whose hash differs or that are new, and records the hashes after the
     relay says 200.
   - When the table is empty, every row goes up: that is the snapshot. It reuses the till snapshot's
     repeatable-read, read-only transaction pattern from `changes/snapshot.ts`.
   - Re-sending a batch changes nothing, because the relay upserts by id (Day 46).
3. **Projection, an allowlist built by one function, `relayProjection(db, orgId)`** in `@shopper/core/relay`:
   - stores `{id, name}`
   - branches `{id, storeId, name}`
   - categories `{id, name, parentId, onlineVisible}`
   - products where `online_visible AND archived_at IS NULL`: `{id, sku, name, categoryId, taxClass, baseUnit, onlineVisible}`
   - prices of those products that are current or future: `{id, productId, branchId, amount, validFrom, validTo}`

   A product that was published but has left the projection (hidden or archived) is sent once more with
   `onlineVisible: false`. The same function runs against the relay org in the cloud database, so the test checks
   "relay equals box" as `relayProjection(box) == relayProjection(relay)`.

4. **Category visibility lives in the database view.** `category.online_visible` defaults to true. `catalogue_public`
   is recreated so a product is hidden when its category or that category's department is hidden. Categories nest
   one level only (`assertDepartment`), so the view needs one join to the category and one to its parent. Cloud orgs
   get the same behaviour. Toggling a category is one delta row.
5. **The Online Orders switch** is `org.online_orders` (default false). Turning it on clears `relay_published`, which
   forces a fresh snapshot; this is also the manual recovery after a relay reset. It then starts the Publisher.
   Turning it off ends the loop. Hiding the online store when the switch is off is Day 49 ("ordering paused").
6. **Wake, where writes happen.** The catalogue router takes an optional `relayPublisher?: WorkflowLauncher`. After a
   successful non-GET request it calls `start(orgId, { orgId })`. That one hook covers products, prices, categories,
   barcodes and imports. Scheduled prices need no wake, because future prices are already published and the store
   prices by `now`. On boot, the box restarts the Publisher if the switch is on.
7. **Stores and branches are published as `{id, name}` today.** Relay prices need branch rows to exist. Addresses,
   hours and slots are Day 48.

## Tests (written first, each must fail before its slice)

`tests/integration/relay/publisher.test.ts` (new). It uses two databases: the cloud DB from `../auth/setup` with
`relayCloud()` and `enrol()` from `relay/support.ts`, and a box DB from `emptyDatabase()` in
`tests/support/migration/archive.ts`, seeded with org id = `licence.org`. The Publisher runs under `memoryLaunch`,
with `send` set to `cloud.send(box, …)`, which records every request body.

1. **Snapshot, then 100 deltas.** Seed 2 stores, 3 branches, a department with 2 categories, 40 products and their
   prices. Publish, then check `relayProjection(cloud, org)` equals `relayProjection(box, org)`. Apply 100 mixed
   changes through the real commands (`setPrice`, `updateProduct`, `saveCategory` visibility, new products,
   archives, hiding a product), publish, and check the two are equal again. Also check that the second run sent
   only the changed rows, not the catalogue, and that a third run sends nothing.
2. **No forbidden field ever leaves the box.** Seed a supplier, cost data and stock movements. Walk every captured
   batch body and check that each key is in the allowlist, and that no key or value names
   cost, supplier, movement or stock.
3. **A price change shows on the online store within seconds.** Change a price on the box. The wake publishes it.
   The cloud's `GET /shop/:slug/products/:id?branch=` returns the new `price` in under 5 s.
4. **The relay refuses, so the Publisher stops.** With Online Orders off in the cloud (403), one run ends with the
   reason recorded and no retry loop.
5. **The Online Orders switch.** With it off, nothing is published. Turning it on publishes a full snapshot. Turning
   it off, then on again, publishes the full snapshot again.

`tests/integration/catalogue/online.test.ts` (new):

6. `PATCH /categories/:id {onlineVisible:false}` hides the products of that category, and of a department's child
   categories, from `GET /shop/:code/products`. Turning it back on shows them again. The change is audited.
7. `GET/PUT /settings/online` reads and saves the switch, audited. A catalogue write and the switch each call
   `relayPublisher.start` (a launcher stub). A cashier without the permission gets 403.

`tests/e2e/portal/settings/online.spec.ts`: the page renders the switch and each category's toggle, saves them,
shows the empty, loading, error and status states, and works from the keyboard alone.

Also updated: the table and migration count tests, `tests/support/security/bodies.ts` (a valid `PUT /settings/online`
body, so the tenant sweep covers the new route), and the export table classification (`relay_published` is box
protocol state and is not archived).

## Changes by slice (commit after each)

**S1 Schema.** Plain `0048_online.sql`; there is no data to preserve.

- `packages/db/pg/src/schemas/catalogue.ts`: add `category.onlineVisible`.
- `schemas/base.ts`: add `org.onlineOrders`.
- `schemas/relay.ts`: add `relayPublished`.
- Recreate the `catalogue_public` view with the category and department joins.
- `packages/export/src/dump/tables.ts`: classify the new table.
- `core/schemas/catalogue`: `categoryInput` and `categoryUpdate` gain `onlineVisible`, so the existing `saveCategory`
  command and `PATCH /categories/:id` carry it with no new command.
- Tests 6 and the count tests.

**S2 Relay protocol.**

- `core/schemas/relay.ts`: `relayBatch` gains `stores`, `branches` and `prices` (strict objects, ≤500 rows each),
  and `onlineVisible` on categories.
- `core/relay/publish.ts`: upsert stores and branches, and insert prices by id with `validTo` updatable, all inside
  the existing `shopper.relay` lock. Order: stores, branches, categories, products, prices.
- New `core/relay/projection.ts` with `relayProjection`.
- Extend the Day 46 `publish.test.ts`; test 2's allowlist check lands here.

**S3 Publisher.**

- New `core/relay/publisher.ts`: build the projection, diff it against `relay_published`, split it into batches of
  500 rows, send them, and record the acked hashes with a `relay.published` `defineCommand` (audited counts, plus
  the workflow checkpoint). `sha256` comes from `@shopper/utils`.
- New `core/workflows/relay.ts`: `runRelayPublisher`, the loop modelled on `runAccount`, using `woken` and
  `LAST_WAKE_MS`.
- New `adapters/box/src/workflows/relay.ts`: `boxRelayPublisher(deps, launch)` with `{ loop: true }` and
  `relaunch()`.
- New `apps/box/src/relay.ts` wires it in when a licence and `SHOPPER_LICENCE_URL` are set. It sends through
  `licence.send()`, which already signs. `app.ts` stays under 250 lines because the wiring lives in `relay.ts`.
- `serveRuntime` and `createApi` take an optional `relayPublisher` and pass it to the catalogue and settings routes.
- Tests 1, 3, 4 and 5.

**S4 Settings and UI.**

- `core` gets `readOnlineSettings` and a `saveOnlineSettings` command. The status read is the Publisher's last
  `workflow_run` checkpoint (published at, waiting count, last error).
- `api/routes/settings.ts`: `GET/PUT /settings/online`, with permission `settings.write` or the same code the other
  org settings routes use.
- `@shopper/backoffice` gets `screens/settings/online/screen.tsx` and
  `components/settings/online/{switch,categories}.tsx`, plus `queries/settings/online.ts`, `schemas/settings.ts`, a
  route, and a "Online store" entry in `SettingsLinks`.
  - The switch card is shown only when `/licence` reports a box.
  - The status line reads: "Published 2 min ago" / "Publishing…" / "Can't reach Shopper, retrying" /
    "Shopper hasn't switched on Online Orders for this box".
  - The categories card lists departments with their categories nested, each with a `Switch`.
  - Built from @shopper/ui `Card`, `Switch` and `Badge` in the `/ui-screen` style. Figma: read the Componets page
    (12-66) for the Switch and card styles, and Dashboard (27-2031) for the settings page layout. The file has no
    online-store frame, so the page follows the shipped settings pages.
- Test 7 and the e2e spec. `/ui-verify` with `playwright-cli` at 1920, 1440, 1366, 768 and 390, plus axe,
  overflow, console and the keyboard path.

**S5 Docs, checks, review, ship.**

- Docs: `docs/engineering/platforms.md` relay section (Publisher, diff, wake, switch); `docs/guides/` for the owner
  steps to switch on online orders; `docs/plans/day47/{plan,verification}.md`.
- Checks: `vp check`, `vp run guard`, and the affected suites (relay, catalogue, shop, sweep, export, db counts).
  Run the full integration suite locally if the machine allows; otherwise CI runs it.
- `/pre-merge-review`: `codex review` on `gpt-6.1-sol`, run inline. Fix every P1 and P2, then commit.
- Then push the `day47-publisher` branch and open the PR with `gh`. Bind it with ccd_pr and watch CI until it is
  green; on failure, fix and push again. Merge, then fast-forward local main.
- Update the Notion Day 47 row: tick the tasks, set Status to Done, and add a "Day 47 completion" section (PR, CI
  runs, tests, review findings, remarks) in the Day 46 format.

## Reused, not rewritten

- `defineCommand` (`@shopper/audit`) and `WorkflowCheckpoint`.
- `woken`, `LAST_WAKE_MS` and `MAX_WAIT_MS` (`core/workflows/wait.ts`).
- `memoryLaunch` with `loop` (`adapters/box/src/workflows/launch.ts`).
- `publishRelay`, `relayBatch`, `relayAccess`, `signedRequest`, `boxLicence().send`.
- `readStoreProduct` and `catalogue_public` (storefront).
- `relayCloud` and `enrol` (`tests/integration/relay/support.ts`) and `emptyDatabase` (`tests/support/migration/archive.ts`).
- `sha256` (`@shopper/utils`).

## Verification

- Every new test fails first. Then two break-checks, each watched failing:
  - remove the `onlineVisible:false` re-send, and test 1 must fail;
  - add `supplierId` to the projection, and test 2 must fail.
- Commands: `vp test --run tests/integration/relay tests/integration/catalogue/online.test.ts`, then the affected
  suites, then `vp check` and `vp run guard`. The e2e spec runs through `vp run` per `testing.md`.
- `/ui-verify` screenshots go into `docs/plans/day47/verification.md`.
- CI green on the PR before merging.

## Not doing today (and when)

- Product images: Day 48.
- Store addresses, hours and slots: Day 48.
- Stock and availability, and hiding the store when the switch is off: Day 49.
- The order inbox: Day 50.
- Hiding the cloud portal's edit buttons on relay orgs: Day 53.
- The edge cache: the store sends `max-age=60`, so "within seconds" holds at the origin. Shoppers behind the edge
  cache may wait up to a minute.
- Relay-side reset detection: the box trusts its own hash table. Switching Online Orders off and on republishes
  everything.
