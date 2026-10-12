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
