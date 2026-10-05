# Shopper

Offline-first supermarket POS for Ghana, sharing business code between
Cloudflare Workers and a Bun/Elysia on-premise host.

Day 1 establishes buildable app boundaries, development services, integration
fixtures and CI. Till hardware, authentication, database schemas, sale commands,
sync and UI design are implemented on their scheduled days.

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
http://localhost:5175. The portal and till currently show the shared About screen.
The box source can run with `vp -C apps/box run dev` (Bun required).

The local database is `postgresql://shopper:shopper_dev_only@127.0.0.1:5432/shopper`.
Tests use a **new database per suite**, then drop it; override with
`TEST_DATABASE_URL` pointing to a test server whose role can create databases.
Rivet runs on localhost:6420 with the local-only token
`shopper_local_development_only`. The virtual printer listens on TCP 9100 and
saves raw bytes under `tooling/printer/captures/` (ignored by Git).
`vp run services:down` stops services and preserves their volumes.

## Boundaries

- `apps/edge`: Worker entry and Cloudflare Vite build.
- `apps/box`: Elysia mounts the same `@shopper/api` Hono app.
- `apps/portal`: TanStack Router back-office SPA shell.
- `apps/shop`: TanStack Start SSR shell with the Cloudflare Vite plugin.
- `apps/till-ui`: React browser shell; no device access.
- `apps/till-host`, `apps/till-electron`: engine and Windows shell boundaries.
- `packages/*`: handbook package boundaries, with strict TypeScript references.

Read `CLAUDE.md` for money, tax, audit, tenancy and portability rules.
Most package exports are intentionally empty until their scheduled day.

## Tests and compatibility

`vp test --run` exercises PostgreSQL 18, the Hono/Elysia API boundary, a real TCP
printer capture, and the Hono Worker in workerd. Cloudflare's test plugin currently
requires a separate Vitest 4 runner; see `tooling/worker-tests/README.md`.
TanStack Start and the Cloudflare plugin build successfully on Vite+ / Vite 8.

## Versions

`package.json` owns the product version. `tooling/build-info.ts` injects
`SHOPPER_VERSION`, `GIT_SHA`, `BUILD_DATE`, `SCHEMA_VERSION`, `SYNC_PROTOCOL`, and
`ARCHIVE_FORMAT` into app builds. CI can supply `BUILD_DATE` and `GITHUB_SHA`.
The API sends `Shopper-Version` on every response and exposes `/about` and
`/health`. UI shells render the same metadata through `@shopper/ui`.

## Staging

Build with `vp -C apps/edge run build:staging`, then use
`vp -C apps/edge run deploy:staging`. The Cloudflare environment is selected at
build time, and deployment uses the generated staging configuration.
Staging API: https://shopper-api-staging.temtem.dev.

Infrastructure identifiers are recorded in `apps/edge/wrangler.jsonc`.
