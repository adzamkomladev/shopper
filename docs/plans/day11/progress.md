# Day 11 progress (handoff)

Plan: [plan.md](plan.md). Branch: `claude/jolly-mendel-4y1tqn`, based on `origin/main` at `b6561a3`. Each
slice is committed and pushed together with an update to this file. When every slice is done, the
branch goes to `main` as one PR that is driven to green CI and then merged.

## Status

| Slice                                           | State                                   | Commit           |
| ----------------------------------------------- | --------------------------------------- | ---------------- |
| Setup (toolchain, services, docs)               | done                                    | setup            |
| S1 Portal SPA mode with bindings                | done                                    | 46d3438, 48c558d |
| S2 Money, schema, permissions groundwork        | done                                    | 18583fa, a95ad6e |
| S3 Tender settlement, till commands, v3, ingest | todo                                    |                  |
| S4 Receipt document model                       | todo                                    |                  |
| S5 MoMo via Paystack workflow (both runtimes)   | in progress (client + fake + live done) | 3208a7b          |
| S6 Golden trading day                           | todo                                    |                  |
| S7 Till UI: tender, held, complete, purchases   | todo                                    |                  |
| S8 Workers Builds auto-deploy (main → staging)  | done in repo; dashboard setup pending   | S8 commit        |
| Finish: review, PR, CI, merge, Notion           | todo                                    |                  |

## Current slice

Several slices are moving at once, each with its own agent:

- **S7 (till UI):** runs in an isolated worktree and is built against the harness. Its bridge
  response types must match design.md.
- **S2:** done. See the S2 notes below.
- **S5a:** done. The Paystack client (`@shopper/core/payments/paystack`), the fake
  (`tooling/paystack/server.ts`) and the live sandbox test are in.

Next is S3, followed by S4 and then S5b. S5b covers the MomoPaymentWorkflow on CF and box, the API
routes, the webhook route and conformance. S8 (Workers Builds deploy) has started now that S1 is done.

### S8 notes (Workers Builds, main → staging)

- **Deploy scripts:** each Worker runs `pnpm --filter @shopper/<edge|portal> run build:staging` and
  then `deploy:staging`, implemented in `tooling/cloudflare/deploy.ts`.
  - Edge: safety name check → requires `DATABASE_URL` → PG migrations → D1 migrations
    (`--env staging`) → `wrangler deploy` → smoke test (`tooling/cloudflare/smoke.ts`).
  - Portal: deploy → smoke test.
- **Dashboard settings:** the table the owner pastes is in `docs/engineering/deployment.md`.
- **Not verified:** there is no Cloudflare token here, so the real deploy, the remote D1/Neon
  migrations and the Workers Builds image behaviour are untested. The latter covers
  `NODE_VERSION=24.21.0`, `PNPM_VERSION=12.9.1` and the watch-path glob syntax. The dry runs list
  every binding, and the smoke test passes against local previews.

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
- No Codex review: its quota is used up. Review with the `reviewer` agent without the Codex step,
  `/code-review` and `ui-reviewer`.
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
`reviewer` (no Codex), with the `/tdd-slice`, `/cloud-box-parity` and `/ui-screen` skills.

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
