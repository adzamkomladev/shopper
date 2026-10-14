# Shopper

Offline-first supermarket POS for Ghana, sharing business code between
Cloudflare Workers and a Bun/Hono on-premise host.

The current implementation includes integer money, dated tax rules, audited commands,
shared adapter conformance, session and device authentication, catalogue import,
versioned prices and scheduled price changes. The portal provides sign-in, shop
switching, catalogue browsing, product editing and import screens. Till sales,
sync and the remaining business workflows follow on their scheduled days.

## Develop

Node 24.21.0 and pnpm 12.9.1 are pinned through Vite+. Install Vite+ 1.0.0, then:

```sh
vp install --frozen-lockfile
vp run services:up
vp check
vp test --run
vp run build
vp run typecheck
vp run dev
```

Portal: http://localhost:5173 · till UI: http://localhost:5174 · customer app:
http://localhost:5175. The portal provides the back office; the till currently shows the shared About screen.
The box source can run with `vp -C apps/box run dev` (Bun required).

The local database is `postgresql://shopper:shopper_dev_only@127.0.0.1:5432/shopper`.
Tests use a **new database per suite**, then drop it; override with
`TEST_DATABASE_URL` pointing to a test server whose role can create databases.
Rivet runs on localhost:6420 with the local-only token
`shopper_local_development_only`. The virtual printer listens on TCP 9100 and
saves raw bytes under `tooling/printer/captures/` (ignored by Git).
`vp run services:down` stops services and preserves their volumes.

## Money, tax and database

`@shopper/money` owns amount arithmetic: 1 GHS = 10,000 integer units, quantities
use thousandths and rates use basis points. BigInt intermediates preserve exact
products; values outside JavaScript's safe integer range are rejected. Half-up
rounding acts on the magnitude, so negative ties round away from zero. Gateway
conversions use `toPesewas()` or `toDecimal(amount, 2)`; never pass a floating
amount to a gateway. `toDecimal(amount, 4)` preserves storage precision.

`@shopper/tax` takes a dated database rule and produces an immutable line
snapshot. The initial seed starts on 1 January 2026: VAT 15%, NHIL 2.5%, GETFund
2.5% and COVID 0%, all on the same base, per the
[GRA notice](https://gra.gov.gh/news/portfolio/notice-to-all-vat-registered-taxpayers/).
Inclusive prices divide by 1.20 using integer ratios. Any residual from rounding
components to four decimals is recorded separately, keeping the gross exact.
Zero-rated and exempt lines retain their distinct class with zero tax. No
historical rate is inferred for dates before the first rule.

```sh
vp run db:migrate
vp run db:seed
```

These commands default to local PG18. For Neon dev, provide its direct connection
URL through `DATABASE_URL` in your shell's secret environment. Do not commit it.
The development seed provisions the dev shop and tax rules, then imports 20,000
catalogue products through the audited import command. It can be rerun.

Drizzle migrations live in `packages/db/pg/migrations`; generate the next forward
migration with `vp exec drizzle-kit generate --config packages/db/pg/drizzle.config.ts`.
Never edit an applied migration. The migration journal makes reruns a no-op;
its infrastructure table lives outside the tenant schema and uses UUIDv7 rather
than Drizzle's default serial key. Domain tables have `org_id`, UUIDv7 key
defaults and timestamps. Composite foreign keys prevent cross-tenant links.
Database triggers maintain `updated_at` and protect audit/version history from
updates and deletes. Every application mutation uses `defineCommand()` to append
an audit row in its transaction; the wrapper now lives in `@shopper/audit`, with trusted context, redacted JSON
snapshots and a per-organization SHA-256 chain. `@shopper/core` re-exports it.
Legacy Day 2 audit rows are preserved and explicitly reported as unhashed by the
verifier. Workflow checkpoints and committed results live in PostgreSQL.

`GET /tax-rules?on=YYYY-MM-DD` selects the latest effective rule for the trusted
session organization. The cloud and box hosts wire session and device authentication
through the shared runtime and fail closed with 503 when it is not configured.
Tenant IDs from request parameters cannot grant access. This boundary is exercised
against real PostgreSQL in CI.

## Boundaries

- `apps/edge`: Worker entry and Cloudflare Vite build.
- `apps/box`: Bun serves the same `@shopper/api` Hono app.
- `apps/portal`: TanStack Router back-office SPA shell.
- `apps/shop`: TanStack Start SSR shell with the Cloudflare Vite plugin.
- `apps/till/ui`: React browser shell; no device access.
- `apps/till/host`, `apps/till/electron`: engine and Windows shell boundaries.
- `packages/*`: handbook package boundaries, with strict TypeScript references.

Read `AGENTS.md` and `docs/engineering/` for every rule: boundaries, code quality,
testing, frontend, platforms, deployment and the AI workflow. `vp run guard` enforces
the import, file-size and no-effect rules.
Hardware, sync and export package implementations follow on their scheduled days.

## Tests and compatibility

`vp test --run` exercises PostgreSQL 18 migration reruns, audited transactions,
exact money storage and dated tax rules through the API, audit tamper/rollback/
concurrent-chain checks, and shared Cache/Blobs/Sequencer conformance on both
Cloudflare and Node development adapters, the cloud/Bun Hono boundary, a real TCP
printer capture, and the Hono Worker in workerd. Cloudflare's test plugin currently
requires a separate Vitest 4 runner; see `tooling/worker/tests/README.md`.
TanStack Start and the Cloudflare plugin build successfully on Vite+ / Vite 8.

## Versions

`package.json` owns the product version. `tooling/build/info.ts` injects
`SHOPPER_VERSION`, `GIT_SHA`, `BUILD_DATE`, `SCHEMA_VERSION`, `SYNC_PROTOCOL`, and
`ARCHIVE_FORMAT` into app builds. CI can supply `BUILD_DATE` and `GITHUB_SHA`.
App build tasks fingerprint the Git revision and explicit version environment
variables, so cached builds cannot keep metadata from an earlier commit.
The API sends `Shopper-Version` on every response and exposes `/about` and
`/health`. UI shells render the same metadata through `@shopper/ui`.

## Staging

Build with `vp -C apps/edge run build:staging`, then use
`vp -C apps/edge run deploy:staging`. The Cloudflare environment is selected at
build time, and deployment uses the generated staging configuration.
Staging API: https://shopper-api-staging.temtem.dev.

Infrastructure identifiers are recorded in `apps/edge/wrangler.jsonc`.

The [workspace source layout](docs/engineering/layout.md) inventories every app and package.
Shared layout rules apply across the whole workspace; the guard enforces re-export-only indexes.
