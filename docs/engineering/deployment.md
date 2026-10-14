# Deployment, versions and migrations

Nothing reaches staging or production unless CI is green: `vp check`, `vp run guard`,
`vp test --run`, `vp run build` and `vp run typecheck`.

## Environments

| Environment | Cloud                                                          | On-prem                                             |
| ----------- | -------------------------------------------------------------- | --------------------------------------------------- |
| Dev         | `vp run dev` (workerd locally), Neon dev or local PG18         | `vp -C apps/box run dev` against local PG18 + Rivet |
| Staging     | `shopper-edge-staging`, https://shopper-api-staging.temtem.dev | A staging box on the LAN                            |
| Production  | Workers + Neon (per `wrangler.jsonc`)                          | Sealed Bun binary at the customer's site            |

Infrastructure identifiers live in `apps/edge/wrangler.jsonc` only. Secrets never go in the repo,
`.env.example` excepted: `wrangler secret put` for Workers and the sealed config for the box.

## Cloud release

```sh
vp -C apps/edge run build:staging          # CLOUDFLARE_ENV is chosen at build time
vp -C apps/edge run deploy:staging         # deploys the generated staging config
```

- Run database migrations **before** deploying code that needs them (expand first).
- Production uses Worker **versions with gradual deployment**: ship to a small percentage, watch
  Workers Logs/Traces for errors, then promote. Roll back by redeploying the previous version.
- After changing bindings, run `vp -C apps/edge run types` and commit the regenerated types.
- Bump `compatibility_date` deliberately, in its own PR, with the Workers suite green.

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
  accepts sync protocol N and N−1. `min_till_version` forces old tills to update.
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

Provision a private imports bucket independently of the existing generated-snapshot R2 binding. Set `SHOPPER_S3_ENDPOINT`, `SHOPPER_S3_BUCKET`, `SHOPPER_S3_ACCESS_KEY_ID`, `SHOPPER_S3_SECRET_ACCESS_KEY` and `SHOPPER_S3_REGION` in Worker secrets/sealed box configuration. R2 uses its S3 API endpoint and region `auto`; RustFS uses the browser-reachable S3 endpoint and configured region. Bind credentials to the imports bucket and required operations. Never expose credentials in browser or log signed URLs.

Configure CORS for exact portal/local origins with PUT and Content-Type. Use HTTPS for non-loopback endpoints and keep the bucket private. Validate provider storage quotas and retention for abandoned uploads separately from the application's bounded processing limit. No production storage policy is changed by the development setup script.

Local tests require `vp run services:up` then `vp run storage:setup`; the latter targets only loopback RustFS with fixture credentials. No dev database reset is required for this cleanup; migrations are forward-only. External R2 deployment, real hardware and the future production box embedding are separate release verification.
