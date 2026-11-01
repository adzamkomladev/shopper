# @shopper/shop

The shoppers' web app: a shopper opens their shop's link (`/<shop code>`), signs in with a code texted
to their phone, and sees their till receipts, points and details. It is TanStack Start rendered on
Workers and shares `@shopper/ui` under its own `data-surface="shop"` theme (bolder type, rounder
corners, a tinted page and small motions that stop under reduced motion).

## Screens

- `/$shop/signin`: the phone, then the six-digit code (it submits on the sixth digit). The page is
  server-rendered with the shop's name.
- `/$shop/account`: a points card when loyalty is on, then the receipts, newest first. `Y` opens the
  "You" sheet (name, email, delivery addresses, sign out).
- `/$shop/receipts/$saleId`: the till's receipt drawn from its stored JSON, plus "Download PDF"
  (`D`) when the till's PDF is linked and verified. Esc goes back.

Account and receipt routes are `ssr: false`: personal data is fetched in the browser from
`/api/shop/account/*` and never rendered on the server. Only the public shop lookup (`readShop` in
`src/functions/shop.ts`) runs as a server function.

## Layout

- `src/worker.ts` hands `cloudflareShopContext(env)` from `@shopper/adapters-cf/shop` to the Start
  server entry. `src/server.ts` sends `/api/*` to `serveShop` (`@shopper/api/shop`), which passes
  only `/api/shop/*` on to the API Worker through the `API` service binding.
- `cloudflare.config.ts` names the Worker `shopper-shop-<stage>` and binds `API` to
  `shopper-edge-<stage>`. `TURNSTILE_SITEKEY` is the public Turnstile site key; empty turns the
  widget off.
- `src/schemas/shop.ts` parses every API answer; `src/queries/` holds the fetch helper and the
  query options.

## Test it

```sh
vp exec playwright test --project shop
```

The `shop` Playwright project builds the app for a Bun host (`tooling/build/shop/e2e.mjs`,
`tests/support/shop/server.ts`) that runs the shared API against the e2e database and the Arkesel
fake, so sign-in reads the real texted code.
