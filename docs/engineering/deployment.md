# Deployment, versions and migrations

Nothing reaches staging or production unless CI is green: `vp check`, `vp run guard`,
`vp test --run`, `vp run build` and `vp run typecheck`.

## Environments

| Environment | Cloud                                                          | On-prem                                             |
| ----------- | -------------------------------------------------------------- | --------------------------------------------------- |
| Dev         | `vp run dev` (workerd locally), Neon dev or local PG18         | `vp -C apps/box run dev` against local PG18 + Rivet |
| Staging     | `shopper-edge-staging`, https://shopper-api-staging.temtem.dev | A staging box on the LAN                            |
| Production  | Workers + Neon (per `wrangler.jsonc`)                          | Sealed Bun binary at the customer's site            |

Infrastructure identifiers live in the Workers' `wrangler.jsonc` files only. Secrets never go in the
repo, `.env.example` excepted: `wrangler secret put` or Workers Builds secrets for Workers, and the
sealed config for the box.

## Cloud release

`main` deploys to **staging only**, through Cloudflare Workers Builds (the dashboard git integration)
on `shopper-edge-staging` and `shopper-portal-staging`. Production goes through the `release` skill.
Workers Builds does not wait for GitHub CI, so merge to `main` only when CI is green.

Both Workers run from the repo root. Each app owns two scripts, invoked as `pnpm --filter <app> run
<script>`:

| Script           | Edge (`@shopper/edge`)                                                                                                                                                       | Portal (`@shopper/portal`)                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `build:staging`  | `CLOUDFLARE_ENV=staging vp build`                                                                                                                                            | Same; the build also prerenders the SPA shell    |
| `deploy:staging` | `tooling/cloudflare/deploy.ts edge`: PG migrations (`DATABASE_URL`, fails fast), D1 migrations (`--env staging`), `wrangler deploy`, optional Worker secrets, smoke test       | `deploy.ts portal`: `wrangler deploy`, smoke test |

- The Vite plugin writes `.wrangler/deploy/config.json`, so plain `wrangler deploy` uploads the
  generated `dist-staging/.../wrangler.json` (edge) or `dist/server/wrangler.json` (portal) with
  every binding, var and domain. `deploy.ts` refuses to run unless that config is a `*-staging`
  Worker. D1 commands do not follow the redirect, hence `--env staging`.
- `vp` and `wrangler` are repo devDependencies, so `pnpm run` finds them with no bootstrap step.
  The image's default pnpm is older than ours: set `PNPM_VERSION`.
- Worker secrets in the build environment are pushed with `wrangler deploy --secrets-file` (listed in
  `deploy.ts`). Prefer setting them once (below); they persist across deploys.
- `tooling/cloudflare/smoke.ts <edge|portal> <url>` checks edge `/health` (200 and `Shopper-Version`)
  and portal `/`, `/products` (SPA shell) and `/api/health` (JSON). `deploy.ts` runs it against the
  custom domain, retrying while it propagates.
- Production uses Worker **versions with gradual deployment**: ship to a small percentage, watch
  Workers Logs/Traces for errors, then promote.
- After changing bindings, run `vp -C apps/edge run types` and commit the regenerated types.
- Bump `compatibility_date` deliberately, in its own PR, with the Workers suite green.

### Workers Builds settings

Set under each Worker, **Settings > Build**. Connect `adzamkomladev/shopper` to both.

| Setting                      | `shopper-edge-staging`                                                         | `shopper-portal-staging`                                                |
| ---------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Git branch (production)      | `main`                                                                         | `main`                                                                  |
| Non-production branch builds | Disabled (Branch control)                                                      | Disabled                                                                |
| Root directory               | `/`                                                                            | `/`                                                                     |
| Build command                | `pnpm --filter @shopper/edge run build:staging`                                | `pnpm --filter @shopper/portal run build:staging`                       |
| Deploy command               | `pnpm --filter @shopper/edge run deploy:staging`                               | `pnpm --filter @shopper/portal run deploy:staging`                      |
| Build watch paths            | `apps/edge/*`, `packages/*`, `tooling/database/*`, `tooling/cloudflare/*`, `pnpm-lock.yaml` | `apps/portal/*`, `packages/*`, `tooling/cloudflare/*`, `pnpm-lock.yaml` |
| Build variables              | `NODE_VERSION=24.21.0`, `PNPM_VERSION=12.9.1`, `CLOUDFLARE_ENV=staging`        | Same                                                                    |
| Build secrets                | `DATABASE_URL` (required); Worker secrets (optional)                           | Worker secrets (optional)                                               |

- Watch paths keep docs-only changes (`docs/`, `tests/`, `.github/`) from redeploying. Edge and
  portal both include `packages/*`, so a shared change triggers both.
- `DATABASE_URL` is the Neon staging **direct, non-pooled** URL, because migrations take locks.
  Hyperdrive uses its own configured connection.
- Optional Worker secrets as build secrets: `SHOPPER_AUTH_SECRET`, `SHOPPER_LINK_SECRET`,
  `SHOPPER_BOOTSTRAP_TOKEN`, `PAYSTACK_SECRET_KEY`, `MAILEROO_API_KEY`, `MAILEROO_FROM`,
  `SHOPPER_S3_*`, plus `SHOPPER_AUTH_URL` on the edge only (the portal has it as a var).

### Order and rollback

- The portal binds the edge's Durable Objects and Workflows (`script_name: shopper-edge-staging`), so
  **the edge must deploy first**, above all when a class or migration changes. If both trigger
  together and the portal fails on a missing class, retry the portal build once the edge build is
  green.
- Roll back with `vp exec wrangler rollback --name shopper-edge-staging` (or `shopper-portal-staging`),
  or pick a version in the dashboard. Rollback does not revert PG or D1 migrations: they are
  forward-only, so keep them expand-compatible with the previous version.

### One-time setup

1. Create the staging API token for Workers Builds (**My Profile > API Tokens**). The generated token
   has Account Settings read, Workers Scripts edit, Workers KV edit, Workers R2 Storage edit, Zone
   Workers Routes edit and User Details/Memberships read. Add **D1 edit** (migrations) and, if a deploy
   reports an authorization error, **Queues edit** and **Hyperdrive read**. Use the same token for both
   Workers.
2. Connect the repo to both Workers and enter the table above. Keep non-production builds off.
3. Add the build secret `DATABASE_URL` to the edge.
4. Set the Worker secrets once, for each Worker, unless pushed as build secrets (the secrets from
   `apps/edge/.dev.vars.example`): `vp exec wrangler secret put <NAME> --env staging`, run in
   `apps/edge` or `apps/portal`.
5. Push a commit that touches the edge and check the build log: migrations, deploy, smoke.

## Box release

- The box is `bun build --compile --bytecode`: one sealed binary with the portal embedded.
- On start, the binary runs pending migrations, records the version in `shopper_meta`, then serves.
- Rollback = restore the pre-upgrade backup + previous binary. Migrations never run backwards.

## Versions (never hard-code one)

- `package.json` owns the product version (SemVer). `tooling/build/info.ts` injects
  `SHOPPER_VERSION`, `GIT_SHA`, `BUILD_DATE`, `SCHEMA_VERSION`, `SYNC_PROTOCOL` and
  `ARCHIVE_FORMAT` into every build. Read these constants, never a string literal.
- Every API response carries `Shopper-Version`. Every audit row and sale is stamped with
  `app_version`.
- Bump a compatibility version only when its contract changes: schema, sync protocol, event `v`,
  archive format, tax rule pack, licence format.

## Database migrations

- Forward-only and idempotent. Generate with
  `vp exec drizzle-kit generate --config packages/db/pg/drizzle.config.ts`. Never edit an applied
  migration.
- Breaking changes use **expand → migrate → contract** across at least two releases. The server
  accepts only sync protocol 3 after the approved Day 11 till-data reset; older tills must re-bootstrap. `min_till_version` forces old tills to update.
- Every migration is exercised by `tests/integration/db` against a fresh PG18 database, rerun to
  prove idempotency.
- Synced events carry `v`. Changing an event's shape bumps `v` and adds an upcaster. Old events and
  archives are upcast, never rejected. `price.changed` v1 deliberately leaves out the price
  `reason`: it stays in the back office, and the payload lists its fields one by one.

## Release checklist

1. CI green on the release commit. Version bumped in `package.json`.
2. Migrations reviewed for expand/contract safety and lock duration on large tables.
3. Staging deployed, and the till sync, a full sale, and the Z-report verified against staging.
4. Gradual production rollout watched in Workers Logs/Traces. Rollback version noted.
5. Box binary built, signed and smoke-tested on a staging box before any site install.
6. Release notes written for owners: what changed, in plain language.

The `release` skill walks through this list.

## Auth link and email configuration

The edge requires `AUTH_FLOWS` bound to the exported `AuthWorkflow` class. Set a dedicated
`SHOPPER_LINK_SECRET` of at least 32 characters alongside `SHOPPER_AUTH_SECRET` and
`SHOPPER_AUTH_URL`; do not reuse the authentication secret. Set `MAILEROO_API_KEY` and
`MAILEROO_FROM` to a sender on a domain verified in Maileroo. The sender is trusted runtime
configuration, never request input. `MAILEROO_ENDPOINT` is optional for the local network
integration fake; production defaults to `https://smtp.maileroo.com/api/v2/emails`.
`SHOPPER_AUTH_URL` also supplies the trusted origin and setup-link base URL.

Use Worker secrets for these values and sealed box configuration on-prem. No sender configuration
makes delivery fail visibly in its checkpoint and leaves explicit retry available. Every box closes public onboarding and keeps the controlled bootstrap-token path;
only the edge explicitly enables `publicOnboarding` in the shared runtime.
The box's current memory workflow engine cannot recover waiting timers on restart; PostgreSQL
still rejects expired/consumed links. Automatic engine recovery is the day 36 slice.

Provisioning reads compiled metadata in shipped callers and explicit build metadata in tooling.
`SCHEMA_VERSION` is derived from the final migration-journal index, so CLI and shipped install
records agree without requiring injected globals in raw TypeScript tooling.

## Direct asset uploads

Apply the asset-table migration before deploying the upload API/browser together. The catalogue import endpoint now accepts JSON `{ assetId }`, while `/catalogue/imports/uploads` issues grants; multipart clients must migrate. Sync envelopes, audit hashes and public auth/tax URLs retain their existing contracts.

The dev/staging private imports buckets are `shopper-imports-dev` and `shopper-imports-staging`, bound as `IMPORTS`; existing `shopper-assets-dev`/`shopper-assets-staging` remain bound as `BLOBS` for snapshots. Cloud internal operations use these native bindings. Provision a private imports bucket independently of the existing generated-snapshot R2 binding. Set `SHOPPER_S3_ENDPOINT`, `SHOPPER_S3_BUCKET`, `SHOPPER_S3_ACCESS_KEY_ID`, `SHOPPER_S3_SECRET_ACCESS_KEY` and `SHOPPER_S3_REGION` in Worker secrets/sealed box configuration. R2 uses its S3 API endpoint and region `auto`; RustFS uses the browser-reachable S3 endpoint and configured region. Use a separate Object Read & Write token scoped to each imports bucket; these credentials sign grants only on the cloud. Internal R2 reads/writes/deletes require no S3 credentials. Bind credentials to the imports bucket and required operations. Never expose credentials in browser or log signed URLs.

Receipt PDFs use a second private bucket, bound as `RECEIPTS` in `apps/edge` and `apps/portal` (`shopper-receipts-dev` for dev with `remote: true`, like `IMPORTS`, and `shopper-receipts-staging` for staging). Set `SHOPPER_S3_RECEIPTS_BUCKET` next to the other `SHOPPER_S3_*` values (the box reads the same name; its RustFS bucket is `shopper-receipts-dev`, created by `vp run storage:setup`). Owner action before receipts upload on staging: create the `shopper-receipts-dev` and `shopper-receipts-staging` buckets and an Object Read & Write token scoped to them (or extend the imports token), then set the secret. Until then grants answer 503 and tills keep their PDFs and retry.

The new `register.settings` permission (till Register settings, test print, drawer test) is seeded only for orgs created after Day 12. For an existing org, an admin grants it to the owner and manager roles on the portal Roles screen, or the environment's data is reset.

Configure CORS for exact portal/local origins with PUT and Content-Type. Use HTTPS for non-loopback endpoints and keep the bucket private. Validate provider storage quotas and retention for abandoned uploads separately from the application's bounded processing limit. No production storage policy is changed by the development setup script.

Local tests require `vp run services:up` then `vp run storage:setup`; the latter targets only loopback RustFS with fixture credentials. No dev database reset is required for this cleanup; migrations are forward-only. External R2 deployment, real hardware and the future production box embedding are separate release verification.

Portal = TanStack Start in SPA mode: a prerendered static shell served by Workers Static Assets; one Worker runs only for `/api/*` (the shared Hono API through native Hyperdrive, D1, R2, Durable Object and Workflow bindings) and `/_serverFn/*` (host-only server functions). Backoffice data stays on the shared API so the box SPA and Electron reuse it. The staging portal is hosted at `https://shopper-staging.temtem.dev` with its own Hyperdrive, D1, R2, queue, Durable Object and Workflow bindings (the Durable Objects and Workflows live in `shopper-edge-staging`); there is no `API` service binding. Workers Builds runs `deploy:staging` per Worker (see Cloud release); the Vite build's `dist/server/wrangler.json` carries every binding, var, domain and `run_worker_first` rule. Set staging `SHOPPER_AUTH_URL` to the portal origin, and permit that exact origin in imports-bucket PUT/Content-Type CORS. Local dev imports CORS permits `http://localhost:5173` and `http://127.0.0.1:5173`; no wildcard or public bucket access is needed.

## Browser Run (receipt rendering)

`apps/edge` and `apps/portal` bind `BROWSER` (`"browser": {"binding": "BROWSER"}`; compatibility date 2026-03-24 or later) and need Browser Run enabled on the Cloudflare account (owner action) before deploy. `quickAction` does not run in local dev; no local code path calls it yet, so the binding is not marked `"remote": true`. Add that flag (it requires a Wrangler login) when a route starts rendering online-order PDFs. Tests use `tooling/browser/server.ts`, a Playwright Chromium stand-in (CI installs Chromium before `vp test --run`).
