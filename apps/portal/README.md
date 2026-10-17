# @shopper/portal

The back-office web app. It is TanStack Start in SPA mode: `vp build` prerenders a static shell
(`dist/client/index.html`) that Workers Static Assets serves for every document, deep links
included. One Worker runs only for `/api/*` (the shared Hono API through native Hyperdrive, D1, R2,
Durable Object and Workflow bindings) and `/_serverFn/*` (host-only server functions in
`src/functions/`). Back-office data stays on the shared API so the box SPA and Electron reuse
`@shopper/backoffice`.

## Run it

```sh
vp run services:up && vp run db:migrate && vp run db:seed   # the dev shop has the code `dev`
cp apps/edge/.dev.vars.example apps/edge/.dev.vars
vp run dev                                                  # portal on :5173, edge on :8787
```

The dev server runs the portal Worker in workerd with the bindings from `cloudflare.config.ts`; local secrets come from `apps/portal/.dev.vars` (the
same template as the edge's). The
Durable Objects and Workflows it binds run in the edge dev Worker, so start both with `vp run dev`.

Create the dev shop's owner once, then log in at http://localhost:5173 with shop code `dev`:

```sh
curl -s localhost:8787/api/auth/sign-up/email -H "Origin: http://localhost:5173" -H "X-Shopper-Org: $(curl -s localhost:8787/orgs/dev | jq -r .id)" -H "X-Shopper-Bootstrap-Token: dev-only-bootstrap-token" -H "Content-Type: application/json" -d '{"name":"Dev Owner","email":"owner@dev.local","password":"dev-owner-password"}'
```

## Layout

- `src/worker.ts` hands `cloudflarePortalContext(env)` from `@shopper/adapters-cf/portal` to the
  Start server entry. Bindings never leave that adapter.
- `src/server.ts` sends `/api*` to `portalRuntime` and everything else to Start, which serves only
  `/_serverFn/*`.
- `src/functions/host.ts` holds the host-only server functions: `readPortalHost` (version,
  environment, public onboarding) and `checkPortalHealth` (Hyperdrive, D1 and R2 probes).
- `cloudflare.config.ts` sets `notFoundHandling: "single-page-application"` and
  `run_worker_first: ["/api/*", "/_serverFn/*"]`, so documents and assets never start the Worker.

## Deploy staging

Workers Builds runs `vp run deploy:staging` per Worker (main to staging). `vp build --mode staging`
writes `.cloudflare/output/v0` with every binding, text value, custom domain and the Static Assets
rules above, and `cf deploy --prebuilt` uploads it. The Worker has
no `API` service binding: `/api/*` runs in the portal Worker itself. `SHOPPER_AUTH_URL` must be the
portal origin, and the upload bucket CORS must allow that same origin. The Durable Objects and
Workflows the portal binds live in `shopper-edge-staging`.
