# Day 11 plan — Tenders & sale completion (+ portal SPA mode)

## Context

Day 11 card: _"every way a Ghanaian customer pays, and a sale that completes atomically"_: cash with change (optional 10-pesewa rounding as its own line), MoMo through Paystack (charge → pending → confirmed, `toPesewas()`), manual card with an approval code, split tender, held sales, void before tender, one-transaction completion (sale + taxed lines + tenders + stock movements + audit), a receipt document model, and a **golden trading-day fixture set**. That fixture set becomes the permanent regression guard for money and tax.

The current state on `origin/main` (b6561a3, Day 10 merged):

- **No payments code exists.** There are no tenders, Paystack, held sales, voids, stock movements or receipt documents.
- `recordLocalSale` (`packages/core/src/till/record.ts`) posts product lines only, and the UI never calls it.
- Ingest (`packages/core/src/sales/validate.ts`) rejects price-label lines and discounts.
- The golden fixtures are a single-sale stub.

**Portal SSR.** Day 10 moved `apps/portal` to TanStack Start. Every document request now runs the Worker (`run_worker_first: true`, `defaultSsr:false` shell render). Also, `tooling/cloudflare/portal.ts` drops every binding except ASSETS, so a deployed portal would return 503 on `/api`. The owner wants a **pure SPA**: a static shell, with the Worker only for `/api/*` and server functions, and native Hyperdrive and other bindings.

**Decisions made with the owner:**

1. **Portal mode:** TanStack Start **SPA mode**.
   - The shared Hono API stays the data path, so the box SPA and Electron keep working.
   - Server functions are used only for portal-host concerns.
2. **Paystack:** the owner supplies a **Paystack test secret key**. Add it as the environment secret `PAYSTACK_SECRET_KEY` (see "Before starting").
   - CI still uses a local fake that speaks the real contract (testing.md rule).
   - The live sandbox spec runs when the key is present.
3. **UI scope:** tender panel, held sales, void, sale-complete view, and read-only **Purchases list and detail** on the till.
   - Reprint, returns and Register settings stay on Days 12–14. No dead buttons.
4. **Data is disposable.** No backward compatibility:
   - Reset Postgres, D1, KV and till SQLite freely.
   - The sale event jumps to **v3 only**: the v1/v2 upcasters and fixtures are deleted, and the sync protocol is bumped so tills re-bootstrap.
   - Till SQLite migrations are collapsed into one fresh schema.
5. **No Codex.** Reviews use the `reviewer` agent and the `pre-merge-review` skill with the Codex step skipped, plus `/code-review` and `ui-reviewer`.
6. **Progress doc, commits and pushes.** After every slice, in this order:
   1. update the handoff doc `docs/plans/day11/progress.md` (format below);
   2. commit, with the doc in the same commit;
   3. push to `claude/jolly-mendel-4y1tqn` with `git push -u origin claude/jolly-mendel-4y1tqn`, retrying with backoff on network errors.

   No AI attribution anywhere.

7. **Finish.** When every slice is done:
   1. open a PR to `main`;
   2. subscribe to its activity and watch CI;
   3. fix every failure with validated pushes;
   4. merge once CI is green and there are no conflicts.

## Progress doc (`docs/plans/day11/progress.md`)

This is the handoff another agent can resume from if credits run out. It's created in setup, before S1, and rewritten after each slice. Sections:

- **Status table:** each slice S1–S7 and finish → `todo | in progress | done`, plus the commit SHA.
- **Current slice:** exactly what's done, what's half-done (files touched), and the next concrete step.
- **Decisions made:** the owner decisions above plus any taken during implementation, with the reason.
- **How to resume:**
  - setup commands (vp install, services, db reset);
  - the branch name;
  - the test commands for the current slice;
  - the agent/skill to use next.
- **Known failures and blockers:** e.g. Docker unavailable, a missing Paystack key, a flaky spec, each with what was tried.
- **Verification log:** commands run, with pass/fail counts.
- It links back to this plan, which is copied into the repo as `docs/plans/day11/plan.md` in the setup commit.

## Before starting (setup, ~20 min)

- **Reset the branch:** `git fetch origin main && git checkout -B claude/jolly-mendel-4y1tqn origin/main`. The branch only holds merged history.
- **Toolchain:** `vp` is missing and Node is 22. Steps:
  1. Install Vite+: `curl -fsSL https://vite.plus | bash`.
  2. `vp env` (Node 24.21 and pnpm 12.9 are pinned).
  3. `vp install --frozen-lockfile`.
- **Services:** start `dockerd` and run `vp run services:up` (PG18, Rivet, virtual printer).
  - If Docker can't run, use a throwaway Neon branch through the Neon MCP for the PG fixture.
  - Then `vp run db:migrate && vp run db:seed`, wiping the DB first.
- **Paystack key:** before the live run, the owner adds `PAYSTACK_SECRET_KEY` (`sk_test_…`) to the cloud environment's secrets. I'll show the `read_documentation environment.secrets` card. Also add it to `apps/edge/.dev.vars.example` (name only) and `.env.example`.

## How the work runs (agents, skills, commands)

| Step                                  | Tool                                                                                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Validate this plan, split into slices | `planner` agent + `/feature-plan`                                                                                                                     |
| Failing tests per slice               | `test-author` agent, then `/tdd-slice`                                                                                                                |
| Backend, ports, adapters              | `implementer` agent; `/cloud-box-parity` + `cloudflare` / `workers-best-practices` / `durable-objects` / `wrangler` skills for edge/box/workflow work |
| Till screens                          | `ui-builder` agent + `/ui-screen`, Figma MCP `get_design_context` on frames 99:1973, 48:1465, 133:863, 133:956, 135:1934                              |
| Library docs                          | context7 (TanStack Start SPA mode, Paystack), Cloudflare docs MCP                                                                                     |
| After each slice                      | `checker` agent (`vp check`, `vp run guard`, `vp test --run`)                                                                                         |
| Before each commit                    | `reviewer` agent (no Codex) + `/code-review`; `ui-reviewer` for `.tsx`                                                                                |
| Finish                                | `/pre-merge-review` (Codex step skipped), one push, Notion update                                                                                     |

## Slices (each one is a commit)

### S1 — Portal: TanStack Start SPA mode with bindings

- **`apps/portal/vite.config.ts`:**
  - `tanstackStart({ spa: { enabled: true, prerender: { outputPath: "/index" } }, server: { entry: "server.ts" } })`.
  - This emits `dist/client/index.html` as the static shell.
  - Delete `src/start.ts` (`defaultSsr`), which SPA mode makes redundant.
- **`apps/portal/wrangler.jsonc`:**
  - `assets: { binding: "ASSETS", not_found_handling: "single-page-application", run_worker_first: ["/api/*", "/_serverFn/*"] }`, so documents and assets never start the Worker.
  - Keep HYPERDRIVE, CACHE_DB, BLOBS, IMPORTS, NOTIFICATIONS, the DOs and the workflows.
  - Add the new `MOMO_PAYMENT` workflow (S5).
- **`src/server.ts` / `src/worker.ts`:**
  - The Worker routes `/api*` to `cloudflarePortal` and everything else to the Start handler, which serves only `/_serverFn`.
  - `worker.ts` injects a typed request context from `@shopper/adapters-cf/portal` (`portalRuntime`, `portalHost`). That keeps `cloudflare:*` imports out of `apps/portal` (guard).
- **Server functions** (`apps/portal/src/functions/host.ts`, `createServerFn`, host-only):
  - `readPortalHost`: build constants (`SHOPPER_VERSION`), environment, public-onboarding flag. It's shown in the shell footer.
  - `checkPortalHealth`: Hyperdrive `select 1`, a D1 ping and an R2 head, through a new `cloudflareHealth(env)` in `packages/adapters/cf/src/portal.ts`. Used by the staging smoke test and the e2e test.
  - The backoffice keeps `apiFetch` to `/api`, unchanged.
- **Deploy tooling:**
  - Extract the binding-mapping loop from `tooling/cloudflare/edge.ts` into `tooling/cloudflare/bindings.ts`.
  - Reuse it in `tooling/cloudflare/portal.ts`, so all bindings, vars, routes and `run_worker_first` come from the generated `dist/server/wrangler.json`. Nothing is hard-coded.
  - Delete the stale `apps/portal/cloudflare.config.json`.
- **e2e host** (`tooling/build/portal/e2e.mjs`, `tests/support/portal/server.ts`):
  - Serve `dist/client/**` statically with the `index.html` fallback.
  - Pass only `/_serverFn` to the Start bundle and inject the same context with box adapters.
  - Remove the leftover `SHOPPER_API_URL` from both Playwright configs.
- **Tests first:**
  - `tooling/worker/tests/portal.test.ts` (workerd):
    - a deep link returns the shell from assets with no Worker invocation;
    - `/api/orgs/:slug` and `/api/health` still work;
    - a server function returns host info.
  - The existing portal Playwright suites must stay green.
- **Docs:**
  - `platforms.md`, `architecture.md`, `frontend.md`, `deployment.md`, `management.md`, `developer-experience.md`, `testing.md`, root `README.md`, `AGENTS.md:60`, `apps/portal/README.md`.
  - All of them say: "Portal = TanStack Start SPA mode: static shell on Static Assets; one Worker serves `/api` (shared Hono) and host-only server functions with native bindings; backoffice data stays on the shared API so box/Electron reuse it."

### S2 — Money, tax and schema groundwork (reset allowed)

- **`@shopper/money`:**
  - `roundCash(amount, step)`: half-up to a step (10 pesewas = 1000 units).
  - `toPesewas` stays. Add `fromPesewas`.
  - Assert whole-pesewa amounts for MoMo.
- **PG migration `0015_tenders.sql`** (forward-only and idempotent; the DB is wiped anyway):
  - `sale`: add `status`, `subtotal`, `discount_total`, `cash_rounding`, `tendered`, `change`, `receipt` jsonb.
  - New tables: `sale_tender` (kind `cash|momo|card`, amount, reference, approval_code, last4, payment_id), `stock_movement` (product, branch, sale, quantity_thousandths, reason), `payment` (MoMo intent: reference unique per org, amount, phone, network, status `pending|otp|confirmed|failed|expired`, provider ids, `workflow_run` link).
  - Every table gets `org_id` and UUIDv7 ids.
  - Drizzle schemas: `packages/db/pg/src/schemas/{sales,payments,stock}.ts`.
- **Till SQLite:**
  - Collapse `tillMigrations` into one fresh schema (`packages/db/sqlite/src/till.ts`).
  - Add `sale_draft.status` (`open|held`), `sale_draft.name`, `sale_draft_tender`, `local_sale` tenders/receipt columns, a `stock_movement` mirror, and `payment_intent`.
- **Permissions as data:** add `sale.discount`, `sale.void` and `payment.momo` to `packages/auth/src/schemas/permissions.ts` and the seed role rows.
- **Org setting:** `cashRounding: "none" | "10p"` in the till reference snapshot. The seed defaults it to `"10p"`.

### S3 — Tender settlement and till commands (shared core)

- **`packages/core/src/till/tenders/settle.ts`**, a pure function `settle(totals, tenders, rounding)` returning `{ due, roundingLine, paid, balance, change }`. Rules:
  - Only cash gives change.
  - Card and MoMo can't exceed the balance.
  - Rounding applies only when the sale is fully settled with cash as the last tender. It's recorded as its own receipt line.
  - Every result is an integer through `@shopper/money`.
- **Draft commands** (SQLite `defineCommand`, each one audited) under `packages/core/src/till/drafts/`:
  - `tender.add`, `tender.remove`, `discount.set` (needs `sale.discount`), `hold`, `resume`, `listHeld`, `void`.
  - `void` needs `sale.void` plus a reason. It's refused if a confirmed MoMo tender exists.
  - Basket edits still never touch receipts or the outbox.
- **`packages/core/src/till/sales/complete.ts`** replaces `recordLocalSale`. In one SQLite transaction it:
  1. re-quotes the draft (price labels keep their authoritative gross, and discounts are applied);
  2. settles the tenders and requires balance = 0;
  3. assigns the receipt and builds the receipt document (S4);
  4. writes `local_sale` with tenders, stock movements and the outbox `sale.recorded` **v3**;
  5. deletes the draft and writes the audit row.
- **Bridge:**
  - New browser ops in `packages/sync/src/schemas/bridge/basket.ts`, added to `browserRequests` in `packages/adapters/box/src/till/host/transport.ts`: `tender.add/remove`, `discount.set`, `sale.complete`, `sale.hold/resume/listHeld/void`, `payment.momo.start/otp`, `sales.list/read`.
  - Recoverable errors keep the socket open.
- **Sync:**
  - `saleEvent` v3 in `packages/core/src/schemas/till/sale.ts` (tenders, rounding, discounts, receipt document). Delete the v1/v2 upcasters and `tests/fixtures/sales/v{1,2}.json`.
  - Bump `buildInfo.syncProtocol` and `saleVersion` to `picklist([3])`.
- **Server ingest** (`packages/core/src/sales/{accept,validate}.ts`), inside the existing `sale.accept` transaction:
  - Accept price-label lines (validated through `snapshotAmount`) and permitted discounts.
  - Insert `sale_tender` and `stock_movement`.
  - Check that the tenders reconcile exactly.
  - Check that each MoMo tender references a **confirmed** `payment` with the same amount that isn't already used.

### S4 — Receipt document model

- **`packages/core/src/receipts/`:**
  - `schemas/receipt.ts`: a Valibot `receiptDocument` with `v: 1`. It contains:
    - header: org, TIN, branch and address, device, cashier, receipt number, Accra time;
    - lines: name, qty, unit, discount, gross, tax-class mark;
    - tax summary: net, NHIL, GETFund, VAT, zero-rated and exempt bases;
    - totals, the rounding line, tenders with masked phone and last4, change, and a footer.
  - `build.ts`: `buildReceipt(sale, reference)`, a pure function used by the till and by the server. Rendering and printing are Day 12, built on the shared Satori-safe component.

### S5 — MoMo via Paystack (Workflow, both runtimes)

- **Paystack client:** `packages/core/src/payments/paystack/{client,schemas}.ts`.
  - Fetch-based, using Valibot.
  - `charge` with `mobile_money: { phone, provider: mtn|vod|atl }` and the amount from `toPesewas`.
  - `submitOtp` and `verify`.
  - Webhook signature: HMAC-SHA512 over the raw body with WebCrypto, separate from the utils SHA-256 (rule).
- **`MomoPaymentWorkflow`** (`packages/core/src/workflows/payments/momo.ts`), instance id = payment reference. Steps:
  1. Create the `payment` row and audit it.
  2. Charge.
  3. On `send_otp`: set status `otp` and `waitForEvent("otp")`.
  4. `waitForEvent("paystack.charge")` with a timeout. On timeout, call `verify` **once**; this is not polling.
  5. Mark confirmed, failed or expired. Each step writes its table, an audit row and `workflow_run`.
  6. Push the status to the till through Realtime (StoreHub).
- **API routes** (`packages/api/src/payments/routes.ts`):
  - `POST /payments/momo` (needs `payment.momo`).
  - `POST /payments/momo/:ref/otp`.
  - `GET /payments/momo/:ref`.
  - Public `POST /webhooks/paystack`, which checks the signature then sends the workflow event.
- **Adapters:**
  - CF: a workflow class exported from `apps/edge/src/index.ts`, with `MOMO_PAYMENT` bindings in the edge and portal `wrangler.jsonc` files and secret `PAYSTACK_SECRET_KEY`.
  - Box: a Rivet workflow twin.
  - A `packages/conformance` case for the workflow, passing on both adapters.
- **Fake Paystack:** `tooling/paystack/server.ts` covers charge, OTP, verify and signed webhook delivery, mirroring the Maileroo fake pattern.

### S6 — Golden trading day

- **`tests/fixtures/sales/golden/`:**
  - `references.ts`: products across standard, zero-rated and exempt classes, a weighed product (EAN-13 prefix 2x), a price-label product, and 2026 tax rules.
  - `day.ts`: about 20 sales covering:
    - single cash with change; cash with 10p rounding up and down;
    - exact MoMo; card with approval code; split cash + MoMo + card;
    - zero-rated only; exempt only; mixed classes;
    - line discount; weighed items; price-label item;
    - held → resumed → paid; voided before tender.
  - `expected.ts`: hand-checked totals per sale and day totals (gross, net, NHIL, GETFund, VAT, rounding, tenders by kind, change) at **4dp and 2dp**.

### S7 — Till UI (Figma)

- **Tender panel:** `apps/till/ui/src/components/sale/tender/{panel,keypad,methods,quick}.tsx`, replacing the `summary.tsx` "payments next step" notice. It follows frame 99:1973 / 48:1465:
  - balance due and amount received;
  - amount-tendered input;
  - keypad (0–9, 00, C, backspace);
  - quick-cash buttons (exact amount plus the next GHS notes);
  - method cards **Cash / MoMo / Card** (frame 133:863 style, Gift replaced by MoMo);
  - Split, and Charge with the amount.
- **Dialogs:**
  - `momo.tsx`: phone, network, pending / OTP / confirmed / failed / expired states, live status from host push, retry.
  - `card.tsx`: approval code, optional last4.
  - `complete.tsx`: the large change-due figure, a receipt summary from the receipt document, and "New sale" (Enter).
  - `held.tsx`: list, resume, and void with a reason.
- **Shortcuts** (legend in `hints.tsx`, all through `useShortcuts`):
  - F5 tender/charge, F6 hold, F7 held list, F11 void;
  - Alt+1/2/3 select a method;
  - Enter charges, Esc backs out.
  - No `useEffect`. Held sales stay alive with `<Activity mode="hidden">`.
- **Purchases:** `apps/till/ui/src/screens/purchases/{list,detail}/screen.tsx` and `components/purchases/*`, following frames 133:956 and 135:1934.
  - **List:** today's till sales, tabs (All / Completed / Voided / Pending MoMo), receipt search, tender filter, pagination.
  - **Detail:** lines with tax, order totals, tenders with approval or MoMo reference, receipt metadata.
  - No Reprint or Return buttons until Days 12 and 14.
  - Top navigation is Sale / Purchases as in Figma.
- **Store:** `sale/store.ts` gains tender and complete actions. Harness fixtures (`apps/till/ui/harness/fixtures.ts`) get every new state.
- Every state is designed: loading, empty, offline (MoMo disabled with a reason), error, insufficient tender.

## Tests (written first, by `test-author`)

**Integration** (`tests/integration/`, PG18 fixture):

- `sales/golden/day.test.ts`: every golden sale through draft → tender → complete (till SQLite) → push → `sale.accept` (PG). Every total must be exact at 4dp and 2dp, and the day totals must match.
- `sales/tenders/{cash,rounding,split,card}.test.ts`: change, the rounding line, overpay refusal on card/MoMo, and an insufficient balance blocking completion.
- `sales/completion/atomicity.test.ts`: a failure injected after the stock movements leaves no sale, tender, stock or audit rows on either side.
- `till/basket/{hold,void,discount}.test.ts`: hold, resume, multiple held sales, void permission and reason, discount permission.
- `payments/momo/{workflow,webhook}.test.ts`, against the fake Paystack:
  - charge → pending → webhook → confirmed;
  - the OTP path;
  - a bad signature gets 401;
  - timeout → single verify → expired;
  - a sale whose tender is unconfirmed or reused is rejected.
- `payments/momo/live.test.ts`: Paystack **sandbox** charge plus OTP plus verify with the test number. It runs only when `PAYSTACK_SECRET_KEY` is set, and is run once today with the owner's key.
- Conformance: the MoMo workflow case on CF and box.
- `tooling/worker/tests/portal.test.ts`: SPA shell, `/api`, server functions.

**e2e** (Playwright):

- `tests/e2e/till/ui/sale/tender.spec.ts` (harness): keypad cash with change, split, card, MoMo states, hold and resume, void, completion view.
- `purchases.spec.ts`: list filters and detail.
- `live.spec.ts`: extended to scan → tender → complete against a real host.
- The portal suites stay green.

## Verification (end of day)

1. `vp check`, `vp run guard`, `vp test --run` (full integration suite), `vp run build`, `vp run typecheck`, `vp run e2e` and the public Playwright config. All must be green, with results recorded in `docs/plans/day11/verification.md`.
2. Portal: run `vp run build` in the portal, then `wrangler dev` on the built output:
   - a deep link loads the shell with no Worker log line;
   - login works through `/api`;
   - `checkPortalHealth` reports Hyperdrive, D1 and R2 ok.
3. Till in the browser against a real host: ring up a basket, pay with split cash + card, see change and the rounding line, then open it in Purchases. Take screenshots against the Figma frames (`ui-reviewer`).
4. A live Paystack sandbox MoMo charge with the owner's key.
5. Review: the `reviewer` agent and `/code-review` over the full diff, plus `ui-reviewer`. Fix every confirmed finding. Then `/pre-merge-review` (Codex skipped).
6. **Final push, then the PR** (the owner asked for one):
   - Final push of the progress doc, then open a PR `claude/jolly-mendel-4y1tqn` → `main` through the GitHub MCP. Use the repo's PR template if one exists, with no attribution.
   - `subscribe_pr_activity` and act on each CI or review event: reproduce the failure, fix it, validate locally, push.
   - Keep a safety-net check-in armed.
   - Once CI is green, nothing conflicts and no review thread is open, merge with `merge_pull_request`, matching the repo's previous merge style.
   - Record the PR, CI runs and merge commit in `progress.md` and `verification.md`.
7. **Notion, Day 11 page** (`3eba2c99-9ce9-81b7-998a-e5e881696116`):
   - tick the tasks and set Status = Done;
   - add a "Remarks (15 Oct)" section: what shipped, the portal SPA change, test counts, the live Paystack result, deviations (v3-only events, reset data), and what moves to Day 12 (printing and rendering, real peripherals).

## Risks

- **Scope is large.** The portal SPA slice (S1) is independent, so it goes first and is committed alone. If the day runs over, Purchases (the end of S7) is the first thing to slip to Day 12; this would be noted in Notion.
- **Live Paystack webhooks can't reach a local host.** The live test covers charge, OTP and verify. The webhook → workflow path is covered by the fake with real signatures.
- **Docker may not run in the container.** The fallback is a Neon test branch.
