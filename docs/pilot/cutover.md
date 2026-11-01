# Production cutover

The steps from nothing to a live pilot, in order. All pilot data is disposable until go-live day.

## 1. Provision (once)

Signed in with `vp exec cf auth login` (from `apps/edge`) and to Neon:

1. **Neon**: the project's `production` branch (endpoint `ep-withered-frost-zadpse2f`). Its direct
   connection string is `DATABASE_URL` for migrations and the Hyperdrive origin; Hyperdrive pools itself, as
   on staging. Restore reaches back as far as the project's history retention: 6 hours on the current plan,
   so raise it to 7 days before go-live.
2. **Hyperdrive** `shopper-production` on the direct string, caching off. **D1** `shopper-cache-production`.
3. **R2** `shopper-assets-production`, `shopper-imports-production`, `shopper-receipts-production`. CORS on
   imports only, as on staging: PUT from `https://shopper.temtem.dev` with the `Content-Type` header.
4. **Queues** `shopper-notifications-production` and `shopper-notifications-dlq-production`.
5. Put the Hyperdrive and D1 ids in `ids.production` in `apps/{edge,portal,admin}/cloudflare.config.ts`
   and commit them. `deploy.ts` refuses a production build without them.
6. **Secrets**, per Worker, with `vp exec wrangler secret put <NAME> --name shopper-<app>-production`: the
   names under `secrets` in each `cloudflare.config.ts`. New values, never staging's. Hubtel only if used.
7. **GitHub**: environment `cloud-production` with secrets `CLOUDFLARE_API_TOKEN` (the staging token's
   scopes on the production Workers) and `DATABASE_URL` (direct), and required reviewers.

## 2. Release

1. Actions > Release cloud, `promote` off: every Worker uploads a version that serves nothing. Fix
   anything that fails here; traffic has not moved.
2. Run it again with `promote` on: edge migrates and deploys, then portal, then admin, each smoke tested
   against its domain (edge includes `/health/ready`).
3. Write down each Worker's deployment id for rollback: `vp exec cf workers deployments list
   --worker shopper-<app>-production` (from `apps/edge`).

## 3. First admin and shop

1. Seed the platform org and its owner (`seedPlatform` in `tooling/database/platform.ts`) over the direct
   `DATABASE_URL`, then sign in at https://shopper-admin.temtem.dev. Never run `db:seed` against
   production: it also adds demo shops.
2. Sign the pilot shop up on https://shopper.temtem.dev, approve its KYB in the admin app, enrol each
   register with the till installer from the pilot feed.

## 4. Go live

1. Set the repository variable `PRODUCTION_LIVE` to `true`: the uptime probe starts.
2. Prove a backup: branch Neon production at a timestamp from the last hour and run
   `vp exec tsx tooling/backup/verify.ts <branch-direct-url>`; delete the branch after.
3. Hand the shop the cashier and manager guides.
