# @shopper/admin

The platform admin app for Shopper staff: the business verification (KYB) queue, one case with its checks, scans
and the decision, and every shop with its onboarding and verification. Screens live in `@shopper/platform`; this
app is wiring only, the same shape as `apps/portal`: TanStack Start in SPA mode, a prerendered shell served by
Workers Static Assets, and one Worker that runs only for `/api/*` (the shared Hono API).

Cloud only. The box has no admin app and mounts no `/platform` routes.

## Who gets in

Staff are members of the platform org, whose code `SHOPPER_PLATFORM_ORG` names (`shopper` in dev, e2e and
staging). They sign in with the same Better Auth session as any shop. `/api/platform/*` answers only a session in
that org holding `platform.kyb.review` or `platform.tenant.read`; those permissions exist only as rows in the
platform org, so a shop owner granting them to themselves gets nothing.

`vp run db:seed` creates the org and `staff@shopper.local` (password `SEED_PASSWORD`); the e2e database gets
`staff@shopper.test`.

## Run it

```sh
vp run dev        # admin on :5187 next to the portal (:5173) and edge (:8787)
```

The dev Worker binds the remote dev buckets, so it needs `CLOUDFLARE_API_TOKEN`. Without one, run the e2e host,
which serves the built app and the API on Bun against the e2e database:

```sh
node tooling/build/portal/e2e.mjs admin
SHOPPER_PLATFORM_ORG=shopper E2E_ARKESEL_PORT=3105 bun .shopper/admin/e2e/server.js
```

## Deploy staging

`vp run deploy:staging` (Workers Builds, main to staging) builds `shopper-admin-staging` on
`shopper-admin-staging.temtem.dev`. Its bindings are the portal's, plus `SHOPPER_PLATFORM_ORG`; `SHOPPER_AUTH_URL`
is the admin origin, so its sessions are its own.
