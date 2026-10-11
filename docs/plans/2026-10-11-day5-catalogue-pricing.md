# Day 5: Catalogue & pricing

## Context
Day 5 of the 45-day plan ([Notion row](https://app.notion.com/p/3eba2c999ce9811484fbc38010363017)). **Goal:** a real supermarket catalogue can be loaded and priced. **Done when:** a messy spreadsheet becomes a clean catalogue in one import.

Today nothing exists for this:
- No product, category, supplier, barcode or price tables.
- No StoreHub DO and no Realtime adapter.
- Both adapters run the in-memory workflow engine.
- No spreadsheet library is installed.
- The portal is an "About" stub and `@shopper/ui` has no shadcn setup.

**Decisions taken:**
- **Spreadsheets:** SheetJS CE.
- **Scheduled prices:** a real Cloudflare Workflow plus a StoreHub DO behind the Realtime port. The box uses the memory engine and an in-process broadcast until Rivet on day 36.
- **Inventory manager "propose":** deferred to the approvals Workflow. Day 5 writes need `product.write`; the inventory manager gets read only.
- **UI:** shifted to Day 6, its scheduled day, along with the UI kit and portal shell. Day 5 is API only. Day 6 builds the catalogue, prices and import screens on these endpoints, using the Figma components and the reference frames (nodes 12-66, 27-2031, 45-852).

**Data is disposable.** Dev, staging, D1, KV and DO state can be wiped. Migration 0005 is still forward-only and idempotent, because CI reruns migrations. No expand-and-contract is needed.

---

## Goal
An owner or admin can create and import products with several barcodes, units/pack conversions, categories, suppliers and tax classes. They can price products by version with branch overrides, and schedule a time-boxed price change that publishes to stores at start and end. Every write is audited. All of this is exposed as API on both cloud and box.

## Data model: migration `0005_catalogue` (packages/db-pg)
New file `packages/db-pg/src/catalogue-schema.ts`, re-exported from `schema.ts`.

**Conventions:**
- Every table uses `tenant()`, `unique(orgId, id)`, composite tenant FKs, and the `shopper_touch_updated_at` trigger (added by hand in the SQL).
- Money uses `moneyColumn`.
- Quantities are integer thousandths.

**Tables:**

| Table | Columns / constraints |
|---|---|
| `tax_class` (existing) | Add `unique(org_id, id)` so products can FK it |
| `category` | `name`, `parent_id` nullable (department → category); unique `(org_id, lower(name), parent_id)` |
| `supplier` | `name`, `phone`, `email`, `tin`; unique `(org_id, lower(name))` |
| `product` | `sku` (unique per org), `name`, `category_id?`, `supplier_id?`, `tax_class_id`, `base_unit` (CHECK `each\|kg\|g\|l\|ml`), `online_visible bool default false`, `archived_at?` |
| `product_barcode` | `product_id`, `code` (unique per org), `quantity_thousandths int > 0 default 1000`. This is the unit/pack conversion: a case barcode carries 24000 = 24 each. |
| `price` | `product_id`, `branch_id?` (null = all branches), `amount money > 0`, `valid_from timestamptz`, `valid_to timestamptz?` (CHECK `valid_to > valid_from`). Index `(org_id, product_id, branch_id, valid_from desc)`. Rows are append-only via the existing `shopper_reject_history_change()` trigger: a change is a new version, never an update. |
| `product_import` | `file_name`, `sha256`, `status`, `rows_total`, `rows_ok`, `rows_failed`, `report jsonb` (row errors), `price_valid_from` |

**Price lookup rule** (one SQL function in core, used everywhere):
1. Candidates have `valid_from <= at` and (`valid_to` is null or `valid_to > at`).
2. A branch-specific row beats an org-wide row.
3. Among those, the latest `valid_from` wins.

A scheduled window price therefore "reverts" by itself when `valid_to` passes. The workflow only tells the tills.

Also: bump `SCHEMA_VERSION` to `"5"` in `tooling/build-info.ts`.

## Changes by package

**@shopper/auth**: `packages/auth/src/roles.ts`
- Add `product.read`. Grant it to all five roles and add it to `tillPermissions`.
- Price, category, supplier and import writes reuse `product.write` (superadmin and admin), following the Features matrix's single "Edit products and prices" row.

**@shopper/core**: new `src/catalogue/`, exported as `@shopper/core/catalogue`. Each file stays under 250 lines and follows the `mutateManagement` pattern in `packages/core/src/management.ts`: Valibot `strictObject`, `.for("update")` before rows, `details` for before/after, typed `CatalogueError(msg, status)`.

| File | Contents |
|---|---|
| `products.ts` | Commands `product.create`, `product.update`, `product.archive`, `barcode.add`, `barcode.remove`, `category.save`, `supplier.save` |
| `prices.ts` | Command `price.set` (reason required, goes to the audit `reason` column) and command `price.schedule` (inserts the windowed row). Also `priceAt(db, {orgId, productId, branchId?, at})` and `findByBarcode(db, orgId, code, branchId?, at)`, which returns product + quantity + price. |
| `import/parse.ts` | SheetJS `read()` → rows (CSV and XLSX). Header aliases are case- and space-insensitive (`sku/code`, `name/description`, `barcode(s)` split on `; , \|`, `pack barcode` + `pack qty`, `unit`, `category`, `department`, `supplier`, `tax class/vat`, `price/selling price` → `fromDecimal`, `online`). |
| `import/validate.ts` | Per-row Valibot validation plus cross-row checks: duplicate SKU or barcode in the file, a barcode owned by another product in the DB, bad EAN check digit, unknown tax class, price ≤ 0. Output is `{row, column, value, message}`. Bad rows never stop good ones. |
| `import/apply.ts` | Command `catalogue.import`: one transaction and one audit row (payload: sha256, counts, import id). Upserts by SKU in chunks of 1000. Creates missing categories and suppliers by name. Inserts a price version only when the price changed. Writes the `product_import` row with the report. `dryRun` returns the report and writes nothing. |
| `price-change-flow.ts` | `runPriceChange(flow: Workflow, deps, params)`, the one shared function: `sleepUntil(start)` → step `publish-start` → `sleepUntil(end)` → step `publish-end`. Each publish step runs the audited `price.publish` command through `defineCommand`'s workflow checkpoint (records `workflow_run`/`workflow_step` plus audit), then `realtime.publish(orgId, storeId, {type:"price.changed", v:1, ...})` for each of the org's stores. Instance id is `price-change:<orgId>:<priceId>`. |

**@shopper/ports**
- Add a launcher: `WorkflowLauncher.start(kind, instanceId, params)`. Before adding it, confirm none exists in `packages/ports/src/index.ts`.
- The Realtime port (`publish`/`subscribe`) already exists. Implement it; leave its shape alone.

**@shopper/conformance**
New cases, run against both adapters:
- Realtime delivers to subscribers of the same store only (another store or another org gets nothing).
- Launcher plus `sleepUntil` resumes after `advanceClock`.

**@shopper/adapters-cf** (load the `durable-objects`, `workers-best-practices` and `wrangler` skills first)

| File | Contents |
|---|---|
| `store-hub.ts` | `StoreHub` DO, keyed `org:store`, using WebSocket hibernation: `ctx.acceptWebSocket`, an RPC `broadcast(envelope)` that runs `ctx.getWebSockets()` and sends to each. About 20 lines. Exports `cloudflareRealtime(env.STORE_HUB)`. |
| `price-change-workflow.ts` | `PriceChangeWorkflow extends WorkflowEntrypoint`, which adapts `step.do` and `step.sleepUntil` to the port and calls `runPriceChange`. Exports `cloudflareLauncher(env)`, which wraps `env.PRICE_CHANGE.create({ id, params })`. |

In `apps/edge/wrangler.jsonc`:
- Add the `STORE_HUB` DO binding with migration tag `v2` `new_sqlite_classes: ["StoreHub"]`.
- Add the `workflows` binding `PRICE_CHANGE` → `PriceChangeWorkflow`.
- Raise `limits.cpu_ms` for 20k imports.

Then run `vp -C apps/edge run types` and export both classes from `apps/edge/src/index.ts`.

**@shopper/adapters-box**
- `boxRealtime()`: an in-process listener set keyed by org and store.
- `boxLauncher`: `memoryWorkflow` running `runPriceChange`. Mark the ceiling with a `ponytail:` comment: in-flight schedules are lost on restart until Rivet Workflows land on day 36.
- Wire both in `apps/box/src/index.ts`.

**@shopper/api**
- New `src/catalogue-routes.ts`: a Hono sub-app mounted in `createApi`, keeping `index.ts` small. Problems are mapped once at the boundary: `CatalogueError` → status, Valibot → 400, PG `23505`/`23503` → 409.
- Add `products|categories|suppliers|prices|barcodes|catalogue` to the `isPublicRequest` regex in `src/runtime.ts`. Without that, the routes fall through to the public API.

| Route | Permission |
|---|---|
| `GET /products?q=&category=&cursor=` (keyset paging; searches name, SKU and barcode) | read |
| `GET /products/:id` (barcodes, current and future prices, overrides) | read |
| `POST /products`, `PATCH /products/:id`, `DELETE /products/:id` (archive) | write |
| `POST /products/:id/barcodes`, `DELETE /products/:id/barcodes/:code` | write |
| `GET /barcodes/:code?branchId=` | read |
| `GET /prices/at?productId&branchId&at` | read |
| `POST /products/:id/prices` (`set`, or `schedule` with `startsAt`/`endsAt`; schedule calls `launcher.start` **after** commit) | write |
| `GET/POST/PATCH /categories`, `/suppliers` | read / write |
| `POST /catalogue/imports?dryRun=1` (multipart file, ≤ 10 MB), `GET /catalogue/imports/:id` | write / read |

`createApi` options gain `realtime` and `launcher`, injected by `serveRuntime` from each shell.

**Dependency:** `xlsx` (SheetJS CE), pinned to the `https://cdn.sheetjs.com/xlsx-0.20.x/xlsx-0.20.x.tgz` tarball, in core. It is the only new dependency.

**Tooling**
- `tooling/catalogue-fixture.ts`: a deterministic generator (seeded PRNG) of realistic Ghanaian supermarket SKUs. Brands, departments, sizes and weighed produce, with valid EAN-13s, about 10% pack barcodes and about 5% `kg` items. It can write CSV and XLSX, and can inject messy rows (bad price, blank name, duplicate SKU or barcode, bad check digit, unknown tax class, stray whitespace and "GH₵ 12.50" price text).
- Seed: `vp run db:seed` also imports 20,000 SKUs into the dev org **through the import command**, so the seed exercises the real path. The dev DB is reset first, since data is disposable.

## Behaviours as tests (written first)
All files go in `tests/integration/catalogue/` unless noted.

**`products.test.ts`**
- "a product keeps several barcodes and each finds it"
- "a case barcode returns the pack quantity in thousandths"
- "a barcode already on another product is rejected with 409"
- "online_visible defaults to off"
- "every product write leaves one audit row with before and after"
- "org B cannot read or change org A's products"
- "inventory manager and cashier can read but not write" (matrix-driven, extending the existing permission matrix test)

**`prices.test.ts`**
- "price lookup at a timestamp picks the version in force"
- "a branch override beats the org price for that branch only"
- "a windowed price ends and the previous price applies again"
- "a price change writes an audit row with its reason"
- "a non-positive or fractional price is rejected"

**`import.test.ts`**
- "20,000 SKUs import in one go within the time budget" (generated XLSX)
- "bad rows are reported by row and column while good rows land"
- "CSV and XLSX give the same catalogue"
- "re-importing the same file changes nothing and adds no price versions"
- "a dry run writes nothing"
- "one import writes one audit row with the file hash and counts"
- "messy cells (spaces, GH₵ prefixes, mixed-case units) are cleaned"

**`price-schedule.test.ts`** (box adapters, advancing a fake clock)
- "scheduling starts workflow price-change:<org>:<price>"
- "at start every store hub receives price.changed"
- "at end stores are told again and lookup returns the old price"
- "each publish step records workflow_run, workflow_step and an audit row"

**Conformance and workerd**
- `packages/conformance`: the Realtime and launcher cases above, picked up by `tests/integration/ports/conformance.test.ts`.
- `tooling/worker-tests/worker.test.ts`: StoreHub broadcast over hibernating WebSockets, and `PriceChangeWorkflow` end to end with sleeps disabled through the Workflows test introspection API (check support in `@cloudflare/vitest-plugin` 1.3.6 with the cloudflare-docs MCP first). Update the hard-coded `"6 passed"` count in `tests/integration/edge/worker.test.ts`.
- `tests/integration/db`: migration 0005 runs twice cleanly. The existing suite may already cover this.

## Rules at risk
| Rule | How the plan keeps it |
|---|---|
| **Money** | Prices go in through `fromDecimal` only. The column is `moneyColumn`. No floats anywhere: SheetJS numeric cells are read as their formatted text (`raw:false`). |
| **Quantities** | Pack size is stored in thousandths. Weight-embedded barcodes stay on day 10. |
| **Audit** | Every mutation is a `defineCommand`. The import is **one command with one audit row** (hash plus counts, with the full report in `product_import`), not 20k chained rows. Flagged for the reviewer. |
| **Tenancy** | Every table has `org_id`, composite FKs and org-scoped queries, proven by the org-B test. |
| **Platform boundary** | `WorkflowEntrypoint` and the DO stay in `adapters-cf`. Core only sees the ports. |
| **Coordination classes** | StoreHub is one of the five; no sixth is added. |
| **No polling or cron** | `sleepUntil`. |
| **Cache** | No read-after-write. |
| **File size** | The catalogue is split into small files and `api/index.ts` only mounts the sub-app. Watch the guard baseline files (`auth/src/index.ts` 647, already over); don't grow them, put role changes in `roles.ts`. |
| **Synced envelope** | `price.changed` carries `v: 1`. |

## Agents, skills and MCPs

**Claude subagents** (from `.claude/agents/`, role prompts in `.agents/roles/`):

| Agent | Model | Used for |
|---|---|---|
| `planner` | opus | Pre-flight check of this plan against the code before slice 1. Re-plans if a slice uncovers a surprise. |
| `explorer` | haiku | Lookups mid-slice, e.g. how existing tests seed roles and how `serveRuntime` wires options. |
| `test-author` | sonnet | Writes the failing tests for every slice (red first). |
| `implementer` | sonnet | Makes each slice's tests green. |
| `checker` | haiku | Runs `vp check`, `vp run guard` and `vp test --run` after each slice and returns only the failures. |
| `reviewer` | sonnet | Drives `codex review` on `gpt-6.1-sol` and verifies each finding before every commit. |
| `pr-review-toolkit:silent-failure-hunter` | — | Import error paths and the workflow publish steps (slices 4 and 6). |
| `pr-review-toolkit:type-design-analyzer` | — | The port additions (`WorkflowLauncher`, the Realtime envelope) in slice 5. |

**Codex subagents.** `codex exec` with the project's `.codex/agents/*.toml` roles. Each is run in the background, given an explicit file scope so it never touches the same files as a Claude agent, and its result is verified by me before it's kept.

| Codex role | Model | Used for |
|---|---|---|
| `planner` | `gpt-6-astra` | An independent second opinion on this plan alongside the Claude `planner`. The two are diffed and only real gaps are taken. |
| `test-author` | `gpt-6-luna`, high | Adversarial import cases in slice 4 (messy cells, encodings, Excel date/number quirks), appended to `import.test.ts`. Also the workflow timing edge cases in slice 6: start already in the past, end before start, duplicate schedule. |
| `implementer` | `gpt-6.1-sol`, medium | `tooling/catalogue-fixture.ts`, the 20k SKU generator, in slice 4. It runs in parallel with the Claude `implementer` on core, because their files are disjoint. |
| `reviewer` | `gpt-6.1-sol`, medium | `codex review --uncommitted` per slice (through the Claude `reviewer`). Run with effort medium for the whole-branch review in slice 8. |
| `checker` | `gpt-6.1-sol`, low | Cross-checks the final full run in slice 8. |

**Skills:**
- `feature-plan` (done), then `tdd-slice` for every slice.
- `cloud-box-parity` for slices 5 and 6.
- `durable-objects`, `workers-best-practices` and `wrangler`, loaded before any Cloudflare code.
- `superpowers:verification-before-completion` before claiming any slice done.
- `pre-merge-review` in slice 8.
- `commit-commands:commit` for each slice commit.

**MCPs:**
- `cloudflare-docs` for the Workflows test introspection API, the WebSocket hibernation API and the Workflows wrangler config.
- `context7` for the SheetJS `read`/`sheet_to_json` options and drizzle-kit.
- Notion for the final update.

## Slices
Branch: `claude/day5-catalogue-pricing`. Each slice runs `tdd-slice`:
1. `test-author` writes the failing tests, joined by the Codex `test-author` where noted above.
2. `implementer` makes them pass.
3. `checker` runs check, guard and the tests.
4. `reviewer` runs Codex review on `gpt-6.1-sol`.
5. Fix the confirmed findings, then a **commit per slice**.

0. **Pre-flight.** The Claude `planner` and the Codex `planner` check the plan in parallel. Fold in the confirmed gaps, then save it as `docs/plans/2026-10-11-day5-catalogue-pricing.md`. Commit.
1. **Schema + permissions.** Migration 0005, tables, `product.read`, schema version 5, db test. Reset the dev DB.
2. **Products, barcodes, categories, suppliers.** Commands, routes and `products.test.ts`.
3. **Versioned prices.** `priceAt`, `findByBarcode`, `price.set` and `prices.test.ts`.
4. **Import.** SheetJS dependency, parse/validate/apply, the route, `import.test.ts` (20k). In parallel, the Codex `implementer` builds the fixture generator and the Codex `test-author` writes the adversarial cases. `silent-failure-hunter` checks the error paths.
5. **StoreHub + Realtime + launcher** (`cloud-box-parity` skill): conformance first, then the CF and box shells, then workerd tests. `type-design-analyzer` checks the port types.
6. **Scheduled price change.** `runPriceChange`, `PriceChangeWorkflow`, the schedule route, `price-schedule.test.ts` and the workerd workflow test. The Codex `test-author` writes the timing edge cases.
7. **20k seed** through import, plus the `db:seed` wiring.
8. **Pre-merge.** Run the `pre-merge-review` skill over the whole branch: Claude `reviewer`, Codex review at medium effort, and the Codex `checker` on the final run. Fix the findings and commit. Then, **only now**, push and open the PR (not merged).
9. **Notion.** Update the Day 5 row: tick the tasks, add a "Day 5 complete" section (commits, test counts, PR link and remarks: the import-audit choice, box workflow durability until day 36, the screens moving to day 6 (Figma MCP needs authorising before then), and "chase designer" outstanding), and set Status = Done.

## Verification
- `vp run services:up && vp run db:migrate && vp run db:seed`. The seed logs 20,000 products imported.
- Run `vp test --run tests/integration/catalogue`, then `vp test --run` in full. That includes conformance, workerd (`tests/integration/edge`) and the guard test.
- Then `vp check`, `vp run guard`, `vp run build` and `vp run typecheck`.
- Manually against `vp run dev` (wrangler dev runs the real Workflow and the DO), using curl with a signed-in session:
  - `GET /products?q=milo` over the 20k catalogue.
  - `POST /catalogue/imports?dryRun=1` with a messy XLSX from the fixture generator, then the real import, then read the report.
  - Schedule a price change 2 minutes out and watch `GET /prices/at` flip at the start and back at the end.

## Left out deliberately
- **Proposal and approval flow:** on the approvals day.
- **Weight and price-embedded barcodes:** day 10.
- **Till WebSocket route to StoreHub:** day 9 sync.
- **Rivet-durable box workflows:** day 36.
- **Catalogue, prices and import screens:** day 6, with the UI kit and portal shell.
- **Price cancellation or editing of future versions:** add when the UI needs it. Today a new version supersedes the old one.

## Pre-flight amendments (Claude planner + Codex planner, verified against the code)
These override the sections above where they conflict.

**Workflows and the launcher**
- **Instance id:** `price-change_<orgId>_<priceId>`, used for the instance id, `workflow_run.business_key` and the checkpoint. Cloudflare rejects colons (pattern `^[a-zA-Z0-9_][a-zA-Z0-9-_]*$`, at most 100 characters). The example in `docs/engineering/platforms.md` is fixed to match.
- **Launch timing:** `price.schedule` launches the workflow **inside** the command, after the price row is inserted. If the transaction then rolls back, the workflow's first publish step finds no price and ends. This closes the gap between commit and launch.
- **Duplicate starts:** `WorkflowLauncher.start(kind, id, params): Promise<void>` acknowledges the launch only. Starting an existing id is a no-op: CF catches only the "already exists" error, and the box keeps one run per id.
- **Box failures:** the box launcher's background run is `.catch`-ed, marks `workflow_run` failed and logs.
- **Port subset:** `runPriceChange` takes `Pick<Workflow, "step" | "sleepUntil">`. The CF shell maps the retry policy to `retries {limit: maxAttempts-1, delay, backoff}` and opens and closes a Hyperdrive client inside each `step.do`.
- **Publish steps:**
  - Each step runs the audited `price.publish` command with a checkpoint (`waiting`, then `completed`).
  - `appVersion` and `actorId` come in through deps and params.
  - Each step returns the envelopes it built: `id = v7()` and `sequence` from the `Sequencer` port. On replay those same envelopes are republished, so tills dedupe by `id`.
  - A price that no longer exists ends the flow.
- **Long sleeps on the box:** memory `pause()` splits waits over 2^31-1 ms into chunks, so a schedule weeks out doesn't fire at once. Covered by a test.
- **Box connections:** the box launcher and realtime are created lazily, once per process, with their own `Pool`. They are never built at module load and never use the request connection.

**Realtime and StoreHub**
- **Conformance** tests only what both adapters can observe: Realtime same-store delivery and isolation, a same-device resubscribe replacing the old socket, `close()`, and `messageBody()` validation on publish; plus that a launcher duplicate start is a no-op. "Resumes after sleep" moves to `price-schedule.test.ts` (box, real 100–300 ms windows, `vi.waitFor`, `Pool`) and the workerd test (`introspectWorkflowInstance` + `disableSleeps`).
- **Cursor:** the cursor is honoured with a bounded replay buffer: the DO keeps the last 500 envelopes in its SQLite storage, and the box keeps an in-memory ring.
- **StoreHub naming:** `getByName(`${orgId}/${storeId}`)`, as `StoreSequencer` does. The DO and Workflow classes live in an `adapters-cf` subpath so `cloudflare:workers` stays out of `index.ts`. Both are exported from `apps/edge/src/index.ts`.
- **Wrangler:** `STORE_HUB` and the `workflows` binding are repeated in `env.staging`, with workflow names `shopper-price-change-dev` and `-staging`. Migration `v2` is appended.
- **Workerd tests:** they go in a new `tooling/worker-tests/catalogue.test.ts`, added to `include`. The pass count and timeouts in `tests/integration/edge/worker.test.ts` are updated.

**API**
- **Sub-app:** `requirePermission` and `ApiAuthentication` move to `packages/api/src/auth-middleware.ts`, avoiding an import cycle. The sub-app is mounted with `app.route`.
- **Errors:** reuse `ManagementError`; no `CatalogueError`. Add a 409 for PG `23505`.
- **Options:** `ApiOptions` and `RuntimeOptions` gain only `launcher`. Realtime lives in the workflow deps.
- **Reason:** the audit `reason` goes into `CommandContext.reason`.
- **Device branch:** price and barcode lookups by a device principal always use `principal.branchId`. Any `branchId` query parameter is ignored for devices.

**Data**
- **Category and supplier uniqueness:** `uniqueIndex` on `lower(name)` with `NULLS NOT DISTINCT` for `(org_id, lower(name), parent_id)`, and the same pattern for supplier.
- **Price tie-break:** `branch_id IS NOT NULL DESC, valid_from DESC, id DESC`. A newer row with the same `valid_from` wins. An existing future version still wins from its start date; the "supersedes" promise is dropped.
- **Price mode:** `price.amount` is the VAT-inclusive shelf price, the documented default. B2B exclusive mode is day 18.
- **Migration 0005** follows the idempotent pattern of 0003: `IF NOT EXISTS`, guarded constraints and triggers, `price_append_only` and no-truncate triggers. It ships the drizzle journal entry and `0005_snapshot.json`. A new test executes the 0005 SQL a second time.
- **`schema-tax.test.ts`:** the table list and the tenant-table count (24 → 30) are updated.

**Import**
- **Dry run:** a dry run calls parse and validate directly, never `defineCommand`. The command applies only.
- **Cell parsing:**
  - SKU and barcode cells use the raw value as `String(v)` (XLSX), and CSV is read with `raw: true`, so leading zeros survive.
  - Price cells convert the raw number with `String(v)` (shortest round-trip). More than 4 dp is rejected per cell.
  - `fromDecimal` errors become row errors.
  - Tax values are aliased: VAT/15%/standard → standard, zero/0% → zero-rated, exempt/none → exempt.
- **Under the lock:** database-dependent checks (barcode owned by another product) are rechecked inside the command, under its lock.
- **Unchanged rows:** upserts use `setWhere ... IS DISTINCT FROM`, so unchanged rows aren't touched. A re-import still records its `product_import` row and one audit row, and the catalogue rows are unchanged.
- **Timing:** the 20k import has a 60 s budget in Node with an explicit test timeout. A small multipart import also runs through workerd.
- **Fixture generator and dependency:**
  - The generator lives in `tooling/lib/catalogue-fixture.ts`.
  - `xlsx` is pinned to `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` in core and in the root devDependencies (needed for tooling).
  - Core gains the `./catalogue` export.

**Seed**
- `seedDevelopment` imports the 20k catalogue only when it creates the dev org. A reset is a manual step (`vp run services:down/up` or dropping the dev DB), and the seed never resets.

**Guard**
- The baseline numbers in the plan were stale; every file is under 250 lines now. Don't extend `pin-login.test.ts` (234), `permissions.test.ts` (216) or `api/index.ts` (189).
