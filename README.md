# Shopper

Offline-first supermarket point of sale for Ghana. One codebase runs in two places:

- **Cloud**: Cloudflare Workers, Neon PostgreSQL through Hyperdrive, D1, R2, Durable Objects, Workflows and Queues.
- **On-prem**: the sealed **box**, a Bun binary that runs on the store's LAN with PostgreSQL, Rivet and RustFS.

Tills keep selling with no internet and sync when they reconnect. Money is integer (1 GHS = 10,000 units), tax is
read by date and snapshotted onto every sale line, every mutation writes an audit row, and every money event posts a
balanced journal entry.

## Apps

| App           | What it is                                                                                | Dev URL                  | Cloud (production / staging)                                    |
| ------------- | ----------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------- |
| `apps/edge`   | The API Worker (Hono), Durable Objects, Workflows, queue consumer and the daily watchdog  | http://localhost:8787    | `shopper-api.temtem.dev` / `shopper-api-staging.temtem.dev`     |
| `apps/portal` | The back office (`@shopper/backoffice`) as a TanStack Start SPA                           | http://localhost:5173    | `shopper.temtem.dev` / `shopper-staging.temtem.dev`             |
| `apps/admin`  | The platform operator's console: tenants, KYB, billing, support                           | http://localhost:5187    | `shopper-admin.temtem.dev` / `shopper-admin-staging.temtem.dev` |
| `apps/shop`   | The customers' online store (TanStack Start SSR): browse, cart, pickup checkout, receipts | http://localhost:5175    | `shopper-shop.temtem.dev` / `shopper-shop-staging.temtem.dev`   |
| `apps/till`   | The till: `ui` (React), `host` (offline engine, SQLite) and `electron` (Windows shell)    | http://localhost:5174    | Windows installer (`release-till.yml`)                          |
| `apps/box`    | The on-prem server: the same API, back office SPA and sync on the store's LAN             | `vp -C apps/box run dev` | Sealed binary and `shopper-box-installer.run`                   |

`packages/*` holds the shared business code (`core`, `api`, `money`, `tax`, `audit`, `sync`, `db`, `ui`, `backoffice`,
`hardware`, `ports` and the two `adapters`). [layout.md](docs/engineering/layout.md) lists every package.

## Develop

Node 24 and pnpm are pinned through [Vite+](https://viteplus.dev) (`vp`). Docker runs the local services.

```sh
vp install
vp run services:up   # PostgreSQL 18, Rivet, RustFS and a virtual receipt printer
vp run db:reset      # migrate, then seed stores, one user per role and a catalogue; prints the sign-ins
vp run dev           # every app at the URLs above
```

`vp run dev` reaches the dev R2 buckets, so it needs `CLOUDFLARE_API_TOKEN` (or a `cf auth login` session). The local
database is `postgresql://shopper:shopper_dev_only@127.0.0.1:5432/shopper`; `vp run services:down` stops the services
and keeps their data.

## Check and test

```sh
vp check            # format, lint, type check
vp run guard        # imports, file sizes, no effects, layout rules
vp test --run       # integration tests against a fresh PostgreSQL 18 database per suite
vp run e2e          # Playwright end to end
```

Tests come first and are integration or end to end only. See [testing.md](docs/engineering/testing.md).

## Release

- **Staging**: a push to `main` deploys edge, portal, admin and shop through Cloudflare Workers Builds. It does not wait
  for CI, so merge only when CI is green.
- **Production**: run the **Release cloud** GitHub workflow (approval on `cloud-production`). It runs twice: first it
  uploads versions that serve nothing, then with `promote` it migrates, sends all traffic and smoke tests each Worker.
- **Till and box**: `release-till.yml`, `vp run box:seal` and `vp run box:installer`.

[deployment.md](docs/engineering/deployment.md) has the details, rollback and secrets. Cloudflare is driven with the
`cf` CLI.

## Read next

[AGENTS.md](AGENTS.md) has the rules every change follows. The `docs/engineering/` guides cover
[architecture](docs/engineering/architecture.md), [code quality](docs/engineering/code-quality.md),
[frontend](docs/engineering/frontend.md), [platforms](docs/engineering/platforms.md),
[security](docs/engineering/security.md) and [migration](docs/engineering/migration.md). The `docs/pilot/` guides are
for [cashiers](docs/pilot/cashier.md), [managers](docs/pilot/manager.md), [cutover](docs/pilot/cutover.md) and
[rollback](docs/pilot/rollback.md).
