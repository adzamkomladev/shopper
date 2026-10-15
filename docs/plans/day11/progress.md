# Day 11 progress (handoff)

Plan: [plan.md](plan.md). Branch: `claude/jolly-mendel-4y1tqn`, based on `origin/main` at `b6561a3`. Each
slice is committed and pushed together with an update to this file. When every slice is done, the
branch goes to `main` as one PR that is driven to green CI and then merged.

## Status

| Slice                                           | State | Commit |
| ----------------------------------------------- | ----- | ------ |
| Setup (toolchain, services, docs)               | done  | setup  |
| S1 Portal SPA mode with bindings                | todo  |        |
| S2 Money, schema, permissions groundwork        | todo  |        |
| S3 Tender settlement, till commands, v3, ingest | todo  |        |
| S4 Receipt document model                       | todo  |        |
| S5 MoMo via Paystack workflow (both runtimes)   | todo  |        |
| S6 Golden trading day                           | todo  |        |
| S7 Till UI: tender, held, complete, purchases   | todo  |        |
| S8 Workers Builds auto-deploy (main → staging)  | todo  |        |
| Finish: review, PR, CI, merge, Notion           | todo  |        |

## Current slice

Setup is done. Next is S1. The first step is to write `tooling/worker/tests/portal.test.ts` cases for
the static shell, `/api` and server functions, and then switch `apps/portal/vite.config.ts` to
`tanstackStart({ spa: { enabled: true, prerender: { outputPath: "/index" } } })`.

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

## Verification log

- Setup: `vp install --frozen-lockfile` ok. `services:up` ok (PG18, Rivet, RustFS, printer).
  `db:migrate` and `db:seed` ok (20,000 products). `vp run guard` ok.
