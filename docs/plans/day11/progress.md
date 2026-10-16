# Day 11 progress (handoff)

Plan: [plan.md](plan.md). Branch: `claude/jolly-mendel-4y1tqn`, based on `origin/main` at `b6561a3`. Each
slice is committed and pushed together with an update to this file. When every slice is done, the
branch goes to `main` as one PR that is driven to green CI and then merged.

## Status

| Slice                                           | State                                       | Commit           |
| ----------------------------------------------- | ------------------------------------------- | ---------------- |
| Setup (toolchain, services, docs)               | done                                        | setup            |
| S1 Portal SPA mode with bindings                | done                                        | 46d3438, 48c558d |
| S2 Money, schema, permissions groundwork        | done                                        | 18583fa, a95ad6e |
| S3 Tender settlement, till commands, v3, ingest | in progress                                 |                  |
| S4 Receipt document model                       | in progress (implemented)                   |                  |
| S5 MoMo via Paystack workflow (both runtimes)   | in progress (workflow/API/host integration) | 3208a7b          |
| S6 Golden trading day                           | in progress (22 HTTP golden checks green)   |                  |
| S7 Till UI: tender, held, complete, purchases   | in progress                                 |                  |
| S8 Workers Builds auto-deploy (main → staging)  | configured; first build pending             | S8 commit        |
| Finish: review, PR, CI, merge, Notion           | todo                                        |                  |

## Checkpoint requested by owner (15 October 2026)

This commit saves the complete implementation and current review fixes before further work.
It is a work-in-progress checkpoint, not the final completion or merge gate. The companion
[verification log](verification.md) distinguishes successful runs from pending checks.

- Backend is frozen and its checkpoint review passed (GPT-6.1 Sol medium): normalized private
  phone identity/schema/migration checks 18/18; host
  acknowledgement/retry/OTP recovery 9/9; conformance 6/6 box and 6/6 actual Cloudflare Workflows.
- The prior full serial build (27 projects), check, guard and typecheck passed before the latest
  review fixes. Golden HTTP trading day 22/22, 5,000-sale replay 1/1 and live Paystack sandbox 3/3
  remain recorded evidence; affected golden verification after the fingerprint migration is pending.
- Public portal cases are all covered: 26 initial passes, then the malformed-link case and full
  onboarding milestone pass in isolated reruns. The milestone now waits for available role choices
  before exercising its invite shortcut. Parallel Playwright outputs now use separate directories.
- Card validation, receipt shortcut scope and overlay focus checks pass (3 focused tests); OTP
  notice/error/orphan checks pass (2). The fatal-reply waiter fix is implemented; its fresh real-host
  check still needs the corrected readiness and alert locators.
- Purchase error visibility and request sequencing are implemented with scoped checks green.
  Four expected browser reds were reproduced; the newer-selection baseline and final five-case
  green run are pending. Purchase specs now live under `tests/e2e/till/ui/purchases/`.
- Delayed hold/void refresh and same-draft reply ordering are the active remaining UI regressions.
  Hold locking and revision ordering have valid real-host reds; their production fixes are not yet
  applied. The separate void probe still fails in setup and must be corrected before counting it.
  Final real-host, broad browser, repository checks and independent review must run against the
  final stable tree. PR, CI, merge, deployed staging smoke and Notion completion are pending.
- Workers Builds configuration and secrets were set through `cf`; no build/deployment was launched.
  Production is outside this task. The original checkout's unrelated edits remain untouched.

Resume after pushing this checkpoint: finish the remaining UI review regressions, rerun affected
backend golden checks, then final checks/build/typecheck/review. Run real-host browser suites
serially: their shared bridge uses port 5186. Do not edit UI source while another UI suite is
running against port 5194. Continue with the PR and green-CI merge only after the final gates pass.

## Resumed 16 October 2026

The staged checkpoint was committed and pushed as `0c53ecf`. The remaining UI regressions are fixed:

- Hold and active void keep the sale busy until the next open basket loads. `runDraft` takes the
  closing status and awaits its `readDraft` refresh before releasing `busy`.
- The sale store never replaces a draft view with an older revision of the same draft, so a delayed
  command reply cannot overwrite a newer `draft` broadcast.
- The void probe's setup was wrong: the scenario cashier lacks `sale.void`. Test scenarios now accept
  extra role grants, and the transitions spec grants `sale.void`.
- Purchase recovery specs start a fresh register per test; a shared host leaked receipts between
  tests and made receipt locators ambiguous.
- The pre-existing states spec assumed one `<main>`; the hidden Purchases screen stays mounted. It
  now targets the Sale landmark and measures only rendered controls. The totals note names the
  COVID-19 levy when one is charged instead of always claiming VAT, NHIL and GETFund only.

Verification (local): real-host transitions/ordering 3/3, purchase recovery 5/5 (includes the
newer-selection case), fatal-reply connection 1/1, states 22/22; full till UI browser run 84 passed
before the states fix, whose 16 failures plus a load-timed status case then passed in isolation.
Sales/golden, payments, receipts and till integration 246 passed, 3 skipped. `vp check`, guard and
`tsc -b` clean.

## Current slice

Work resumed on 15 October 2026 in the isolated `/root/work/Shopper-day11` worktree at remote
commit `52177ac`. The original `/root/work/Shopper` worktree has unrelated changes and is untouched.

- S3: audited tender, discount, hold/resume/void and a single transactional completion writer are
  implemented. The legacy recording helper delegates to the same writer. Both SQLite and PostgreSQL
  store stock movements, tenders and receipts. Sale events and sync protocol are v3 only.
- S4: versioned receipt schema/builder is implemented, including corrected Accra time, configured
  names, tax bases and masked MoMo details. TIN/address are nullable unless configured.
- S5b: shared workflow, API, signed webhook, both launcher shells, realtime updates and register
  attachment/recovery are implemented. Payment references are reserved locally before charge;
  retries must use the same reference. Unmatched late confirmations remain durable and visible in
  Purchases rather than disappearing after a pending tender is removed or a basket is voided.
- S6: twenty-one fixed golden scenarios plus day reconciliation pass through the production SQLite
  draft/tender/complete path and real authenticated HTTP push, including PostgreSQL acceptance
  and store sequencing (22 checks). Confirmed provider payment
  results are arranged through audited PG fixtures; provider/workflow behavior is tested separately.
- S7: a Luna xhigh agent owns the till UI and browser tests, using all five Figma frames.

Next: push this owner-requested checkpoint before any further implementation. Then finish the
isolated real-host browser checks, final build/typecheck and review, and drive the PR through CI. S3–S7 share the payment attachment schema, transactional
completion contract and unsolicited draft/payment bridge variants. They will be committed together:
the previous UI accesses `message.id` on every non-status message and cannot type-check or handle
the new variants without the updated connection/store. A combined commit keeps the integration
buildable without temporary compatibility code.

Verification so far: draft/settlement focused 9/9; core broad till basket/sales 86 passes plus one
stale expectation corrected and independently rechecked (quotation/storage 22/22); receipt 1/1;
price-label/receipt/permission ingest and cash browser bridge 4/4; purchases bridge 1/1; golden real HTTP push and sequencing 22/22, including fully discounted zero-cash completion.
Full checks and final review are still pending; these focused runs do not establish overall green.

### S8 notes (Workers Builds, main → staging)

- **Deploy scripts:** each Worker runs `pnpm --filter @shopper/<edge|portal> run build:staging` and
  then `deploy:staging`, implemented in `tooling/cloudflare/deploy.ts`.
  - Edge: safety name check → requires `DATABASE_URL` → PG migrations → D1 migrations
    (`--env staging`) → `wrangler deploy` → smoke test (`tooling/cloudflare/smoke.ts`).
  - Portal: deploy → smoke test.
- **Dashboard settings:** the table the owner pastes is in `docs/engineering/deployment.md`.
- **Remote configuration verified (15 October):** the separate `cf` OAuth login has Workers Builds
  read/write scopes. Both existing staging triggers are connected to the repository and now use
  the build/deploy commands and main-only watch paths in `deployment.md`; the old `cf deploy
--prebuilt` commands and exclude-all path filters were replaced. No build was launched.
- **Build variables/secrets:** both triggers have `NODE_VERSION=24.21.0`, `PNPM_VERSION=12.9.1`,
  `CLOUDFLARE_ENV=staging`, the existing staging auth/link/S3 secrets and the existing Paystack
  **test** secret. Edge also has the validated direct, non-pooled staging `DATABASE_URL` and
  `SHOPPER_AUTH_URL`. Secrets were transmitted without command arguments or output and read back
  as hidden values. Existing build-token/repository identities were preserved.
- **Not verified:** the first real build, deployment, remote migrations and image behavior remain
  untested. Currently deployed Workers still lack `PAYSTACK_SECRET_KEY`; the configured build
  secrets will be applied by `deploy:staging` on the next deployment. Staging MoMo is therefore
  not yet verified. The local dry runs list all bindings and smoke tests pass against previews.

### S1 notes

- **SPA shell:** Start runs in SPA mode with `prerender.outputPath: "/index"`, which emits the shell
  as `dist/client/index.html`. Static Assets serves it with `not_found_handling:
single-page-application`, and the Worker runs only for `/api/*` and `/_serverFn/*`.
- **Prerender workarounds:**
  - Remote bindings are disabled during preview, so `IMPORTS` doesn't need an API token.
  - A small `prerenderFlag()` vite plugin writes `TSS_PRERENDERING=true` into
    `dist/server/.dev.vars`. That file is read only by preview and is never deployed.
- **Server functions:** `apps/portal/src/functions/host.ts` defines `readPortalHost` and
  `checkPortalHealth`. Their context comes from `cloudflarePortalContext(env)` in adapters-cf, and
  the types are in `@shopper/api/portal`. The host info renders as `<meta>` tags via `useQuery`. It is
  deliberately not a root loader, which would be baked into the shell at prerender.
- **New Worker var:** `SHOPPER_ENVIRONMENT` (`dev`/`staging`).
- **Playwright:** use `vp exec playwright …`, because `npx` is blocked by devEngines. Run
  `vp exec playwright install chromium` if the browser version mismatches.
- **Verification:** portal Playwright 152 of 152, public 28 of 28, workerd portal 4 of 4, and
  tooling/portal/edge integration 11 of 11.

### S2 notes for later slices

- A trigger (`shopper_preserve_sale`) makes `sale` immutable. Write every new column at INSERT,
  because a later UPDATE is rejected.
- `cashRounding` lives on `org.cash_rounding`. Tills receive it only through snapshots, as a
  `reference` row with `entity='org-setting'`. When a settings endpoint is added, it must append a
  `store_change` row.
- The seeded admin roles are `superadmin` and `admin`, not owner and manager. `cashier` has
  `payment.momo`.
- The till SQLite schema is a single fresh migration. There is no upgrade path, so delete old till
  databases.

### S5a notes (Paystack sandbox findings)

- `0551234987` (mtn) approves at once. `0551234986` returns `send_otp`, and no OTP we found confirms
  it, so the OTP path stays retryable as `otp`. Other numbers are declined.
- Declines come back as HTTP 400 with `data.status:"failed"`. A wrong OTP comes back as HTTP 400
  with `code:"invalid_otp"`, which the client normalises to `otp` so it can be retried. Verifying
  an abandoned charge returns `pending`.
- The sandbox rejects `@shopper.test` emails. Use `example.com`.

## Decisions

- Portal: TanStack Start SPA mode. Static Assets serves the shell, and the Worker runs only for
  `/api/*` and `/_serverFn/*`. Backoffice data stays on the shared Hono API, so the box SPA and
  Electron can reuse it. Server functions are for portal-host concerns only.
- Data is disposable and nothing has to stay backward compatible. Reset Postgres, D1 and till SQLite
  freely. The sale event is v3 only, with no upcasters, and tills re-bootstrap.
- Paystack: `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` are set in the cloud environment. CI uses
  the fake server in `tooling/paystack/`. The live sandbox test runs only when the key is present.
- Day 11 UI covers the tender panel, held sales, void, the sale-complete screen and a read-only
  purchases list and detail. Reprint, returns and register settings are Days 12–14.
- Current work uses the owner-requested gpt-6.1-sol low/medium and gpt-6-luna high/xhigh roles.
  Final review follows the current pre-merge-review skill; the earlier quota note is historical.
- Commits are authored by the repository owner. Never add assistant attribution.

## How to resume

```sh
curl -fsSL https://vite.plus | bash && . ~/.config/vite-plus/env
vp env setup && vp env on && vp env install        # Node 24.21, pnpm 12.9
export PATH="$(vp env print | sed -n 's/^export PATH="\(.*\):\$PATH"/\1/p'):$PATH"
vp install --frozen-lockfile
dockerd &                                          # if Docker is not already running
vp run services:up
export DATABASE_URL=postgresql://shopper:shopper_dev_only@127.0.0.1:5432/shopper   # the env default points at Neon
vp run db:migrate && vp run db:seed
git config user.name "Adzam Komla" && git config user.email "46463371+adzamkomladev@users.noreply.github.com"
```

Checks: `vp check`, `vp run guard`, `vp test --run <path>`, `vp run build`, `vp run typecheck`,
`vp run e2e`. The workflow uses the agents `test-author` → `implementer`/`ui-builder` → `checker` →
`reviewer` (Codex `gpt-6.1-sol`), with the `/tdd-slice`, `/cloud-box-parity` and `/ui-screen` skills.

## Known failures and blockers

- The container's `DATABASE_URL` points at a Neon database. Override it with the local URL above, or
  `db:migrate` hangs.
- Day 10 noted that `api/server.test.ts` fails in containers without IPv6. This is environmental.
- In this container, `catalogue/import/assets/runtime.test.ts` gets an upload grant URL without port 9200. It fails the same way on clean main, so it is environmental. CI is the arbiter.
- Run `vp run storage:setup` once after `services:up` (RustFS bucket and CORS).

## Verification log

- S2: 527 of 529 integration tests pass. The two environmental failures are listed above. `vp check`,
  guard and typecheck are clean. S5a: `vp test --run tests/integration/payments` has 14 of 14
  passing, including the live sandbox test.
- Setup: `vp install --frozen-lockfile` ok. `services:up` ok (PG18, Rivet, RustFS, printer).
  `db:migrate` and `db:seed` ok (20,000 products). `vp run guard` ok.

### Resumed backend verification (15 October 2026)

- Real PostgreSQL API/workflow cases: 13 green, including same-reference retry after launch failure,
  cross-tenant reference conflict, OTP retry, signed/late/replayed webhook and concurrent success.
- Shared MoMo conformance: 5 green on box and 5 green through actual Cloudflare Workflow instances.
  Both cover success, decline, OTP retry, timeout with one verification and provider-error expiry.
- Live Paystack test mode: 3 green using only the existing test secret, without changing it.
- Real register payment HTTP integration: 3 green, including lost creation reply followed by one
  provider charge and one local tender on retry, plus terminal decline recovery after reconnect.
- Local payment integrity: consumed references cannot fund another sale; a confirmation after void
  remains an unresolved purchase; pending amounts constrain basket reductions.
- Server acceptance: signed stock/tenders/receipt reconciliation and rejected card overpayment
  green (2); an injected audit failure rolls every new PostgreSQL completion row back (1).
- Sealed-host receipt metadata: red for unsupported configuration, then green with configured
  branch/cashier/TIN/address returned in the exact stored receipt (1).
- Latest repository guard passed. The first full run exposed stale protocol predecessor assertions
  and payment-route middleware leaking its 16 KiB body limit into sync uploads. Those are fixed;
  a fresh normal-timeout push/ingest/pull regression run passes 22/22. The isolated 5,000-sale
  replay passes 1/1 in 25m25.84s within its unchanged 30-minute budget: 25 bounded batches,
  75 HTTP attempts, 5,000 unique sales/lines/audits/sequences and an empty outbox. The remaining
  integration suite will run separately without repeating this unchanged volume case.
- Provider exception regression: red with 2 failures because charge/verification errors left
  payments pending; then 3/3 green after recording uncertain expiry, failed workflow state and
  realtime notification. Covers late signed success and racing confirmation preservation. A new
  shared HTTP 503 conformance case passes on both runtimes after the volume replay: box 5/5
  (49.86s) and actual Cloudflare Workflows 5/5 (84.97s), both exit 0 with isolated PostgreSQL fixtures.

- Price-label repricing: end-to-end red rejected a legitimate encoded gross after catalogue price
  changed; immutable scan-time `originalPriceId` fixes it without trusting a client denominator.
  Scanner, draft edit/requote and ingest suites pass 20/20, including quantity edits, discounts and
  rejection of another product's price provenance. Core/sync TypeScript and scoped checks pass.

- Cashier payment ownership: red accepted a same-register payment belonging to another cashier;
  adding the server-side cashier equality check makes the regression green (1), with no sale
  persisted and the confirmed payment left intact.

- Terminal MoMo replacement: red completion rejected failed/expired attempts even after another
  tender paid the basket. The writer now excludes terminal attempts, preserves pending/OTP blocks,
  and emits only applied cash/card and confirmed MoMo. Affected suites pass 33/33, including real
  HTTP golden22, cash/card/new-MoMo replacements and late confirmation recovery; scoped checks clean.

### Final verification gates

- The main integration run excluding the separately green volume case completed: 614 passed,
  13 failed, 3 skipped across 152 files. The failures were investigated rather than hidden by
  timeout increases: stale v2/protocol/predecessor/workflow-count assertions, a guard snapshot
  while UI files were changing, cached older payment modules, cold timing failures, captured
  tax-class handling and a borderline large-basket upload.
- Fresh rerun of push, host process, search performance, local payments, protocol/auth/session
  grants and guard passed 29/30; only the large-basket upload remained. Workerd plus portal build
  tests then passed 2/2 with their existing budgets.
- The remaining upload bottleneck was repeated PostgreSQL price/product/class reads. A map scoped
  to one validation transaction preserves the full key and every per-line check. Measured upload
  time fell from 25,854 ms to 13,162 ms. The unchanged push workload and historical/tamper
  regressions pass 10/10; no SQLite writes, inputs or time limits changed.
- Final UI harness: 20/20, including keyboard navigation, receipt locking, stale tender input,
  held void permissions/reason, MoMo permissions, touch targets and accessibility. Mobile detail
  overlap and held-name truncation were reproduced and fixed with responsive layout tokens.
- Real-host browser suite passes 3/3 within unchanged 60-second budgets, including deterministic
  delayed-save and delayed-completion scan-queue regressions. Serial uncached build passes all
  27 projects; full check passes 1,062 formatted and 866 lint/type-checked files; guard and
  `tsc -b` pass.
- Independent GPT-6.1 Sol medium reviews found two backend and six UI issues. These cover MoMo
  acknowledgement ordering and full-phone intent identity, plus card validation, fatal reply
  recovery, transition locking, hidden receipt shortcuts, dialog focus and purchase-detail
  recovery/order. Connected UI reply ordering is also being covered. Fixes and their tests are
  underway; final checks/review must be repeated after those changes.
- The complete public portal browser suite has all 28 cases covered after targeted reruns. The broader 240-test browser run was
  stopped during review fixes to avoid hot reloads against a changing source tree. Its initial
  setup URL mismatch was corrected with explicit isolated helper URLs; product assertions passed
  until the intentional stop. CI, PR, merge and first staging deployment remain pending.

- Local terminal payment monotonicity: delayed pending/OTP replies previously revived failed/expired
  attempts and overwrote confirmed failure metadata (3 red cases). A shared local resolver preserves
  terminal status/reason and allows late confirmation; local payment and real-HTTP host suites pass
  13/13, with scoped formatting/lint/type checks clean.
- Backend review fixes: normalized full-phone fingerprints now bind retries to the original intent
  without storing raw phone numbers or exposing the fingerprint. Identity/schema/migration checks
  pass 18/18; conformance passes 6/6 on box and 6/6 on actual Cloudflare Workflow instances. Real-host
  acknowledgement, retry and wrong-OTP recovery checks pass 9/9, with scoped checks clean. The host
  preserves newer durable updates over delayed acknowledgements; the source comment records that
  OTP POST returns the row captured before sending the workflow event. Same-status OTP errors are
  published from the retained public payment view, and a valid retry clears the error.
