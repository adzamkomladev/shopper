# @shopper/portal

The back-office web app: a Vite SPA that mounts `@shopper/backoffice`. In development it proxies
`/api` to the edge Worker (`SHOPPER_API_URL`, default `http://localhost:8787`).

## Run it

```sh
vp run services:up && vp run db:migrate && vp run db:seed   # the dev shop has the code `dev`
cp apps/edge/.dev.vars.example apps/edge/.dev.vars
vp run dev                                                  # portal on :5173, edge on :8787
```

Create the dev shop's owner once, then log in at http://localhost:5173 with shop code `dev`:

```sh
curl -s localhost:8787/api/auth/sign-up/email -H "Origin: http://localhost:5173" -H "X-Shopper-Org: $(curl -s localhost:8787/orgs/dev | jq -r .id)" -H "X-Shopper-Bootstrap-Token: dev-only-bootstrap-token" -H "Content-Type: application/json" -d '{"name":"Dev Owner","email":"owner@dev.local","password":"dev-owner-password"}'
```

`src/app.tsx` mounts the router and query client. The HTML entry `src/index.tsx` only re-exports it.

## Deploy staging

```sh
vp -C apps/portal run build:staging
cd apps/portal
cf deploy --prebuilt
```

The build uses the existing SPA configuration and writes a portable Cloudflare build output under
the ignored `.cloudflare/output/` directory. `cloudflare.config.json` declares the staging domain,
Static Assets SPA fallback and an `API` service binding to `shopper-edge-staging`. The Worker
forwards `/api/auth` unchanged and strips `/api` from other API paths, preserving request bodies,
cookies and Origin. API failures never fall back to SPA HTML. The API must trust the portal origin
in `SHOPPER_AUTH_URL`; upload bucket CORS must allow that same origin.
