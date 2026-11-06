# Security: what protects a shop, and the rule each change keeps

Read this before touching sign-in, sessions, the runtime entry (`packages/api/src/runtime.ts`), a new
route, audit payloads or the till's local database. Every section names the test that holds it.

## Rate limits

One `RateLimiter` port (`packages/ports/src/limits.ts`) with a fixed policy table:

| Policy     | Limit       | Key                         | Covers                                                                         |
| ---------- | ----------- | --------------------------- | ------------------------------------------------------------------------------ |
| `auth`     | 5 per 10 s  | client IP, and email        | sign-in, sign-up, password reset, onboarding, invitation acceptance            |
| `public`   | 30 per 10 s | client IP                   | statement links, the shop-code lookup                                          |
| `enrol`    | 10 per 60 s | client IP, across all shops | till self-enrolment                                                            |
| `cashier`  | 20 per 60 s | shop and client IP          | cashier sign-in from a register (the per-user PIN lockout still applies)       |
| `otp`      | 10 per 60 s | client IP                   | "text me a code" on the shop's sign-in (each phone also gets 5 logins an hour) |
| `checkout` | 5 per 60 s  | client IP                   | placing an online order (each holds stock for 30 minutes)                      |

- Cloud: one Cloudflare Rate Limiting binding per policy (`RATE_AUTH`, `RATE_PUBLIC`, `RATE_ENROL`,
  `RATE_CASHIER`, `RATE_OTP`, `RATE_CHECKOUT`), built from the table by `apps/edge/cloudflare.config.ts`, through `cloudflareRateLimiter`.
- Box: `boxRateLimiter`, an in-process fixed window. The box is one Bun process, so the count is exact.
  The Rivet `RateLimiter` actor replaces it on day 36.
- `serveRuntime` enforces it before routing (`enforceRateLimit`). A limited request gets `429` with
  `Retry-After`. A runtime with no limiter answers `503` on those routes: it fails closed.
- Better Auth's own limiter is off, so there is one mechanism.
- Tests: `tests/integration/security/ratelimit.test.ts`, and conformance against both adapters.

## Lockout and manager unlock

- 5 wrong PINs or passwords lock that user for 15 minutes, in PostgreSQL and in the till's own SQLite.
- A `429` carries `lockedUntil`, so the till says "Try again at 14:35".
- Anyone holding the `staff.unlock` permission (data, granted with `cashier.pin.assign`) can clear the lock
  early:
  - back office: the Unlock action on the People screen (`POST /users/:id/unlock`)
  - till: Manager unlock (Ctrl+U) on the locked sign-in, approved with a manager's PIN, offline
- Unlock is a command with an audit row of the lock state before and after. Another shop's user is a 404.
- Tests: `security/lockout.test.ts`, `e2e/till/ui/signin/unlock.spec.ts`,
  `e2e/portal/users/unlock.spec.ts`.

## Sessions, cross-site requests and headers

- Session cookies come from Better Auth. Over https they are `__Secure-`, `Secure`, `HttpOnly` and
  `SameSite=Lax`. A session lasts 12 hours, and sign-out revokes it on the server.
- In cloud mode the shop is chosen by `X-Shopper-Org`, and auth is built for that shop alone. A cookie from
  shop A that names shop B resolves to no session.
- `refuseCrossSite` (`packages/api/src/middleware/hardening.ts`) lets an unsafe method through only when one
  of these holds; everything else gets `403`:
  - its `Origin` equals the base URL
  - it has no `Origin` but sends `Sec-Fetch-Site: same-origin`
  - it carries no cookie at all, like a device bearer call or a webhook
- `secureHeaders` sets these on every response except a WebSocket upgrade:
  - `nosniff`
  - `Referrer-Policy: no-referrer`
  - `X-Frame-Options: DENY`
  - HSTS over https
  - `Cache-Control: no-store` on authenticated requests
- The portal and admin static assets send `frame-ancestors 'none'` from `public/_headers`.
- Tests: `security/session.test.ts`, `tooling/cloudflare/portal.test.ts`.

### Shoppers (`apps/shop`)

- A shopper signs in with a six-digit code texted to their phone. The code is never stored or queued:
  it is derived by HMAC from the login id and the send number, and the login row keeps only a keyed
  digest. A login lasts 10 minutes, sends at most 3 codes and locks after 5 wrong ones; a locked or
  expired login means starting again. The reply to "text me a code" is the same for a phone the shop
  knows and one it does not.
- Turnstile guards "text me a code" when `TURNSTILE_SECRET_KEY` is set on the API Worker; the shop
  Worker serves the public `TURNSTILE_SITEKEY`.
- The session is a random 32-byte token in the `HttpOnly`, `Secure`, `SameSite=Lax` shop cookie; only
  its SHA-256 is stored. It lasts 30 days and sign-out revokes it.
- Every `/shop/account/*` route takes the shop from the session row, never from the request. An
  account sees only sales rung up to customer rows with its phone at that shop (and rows merged into
  them). Profile edits change the online account, never the shop's `customer` row.
- Tests: `tests/integration/shop/*` (sign-in, account, profile) and the tenant sweep.
- The store (`/shop/:code/store`, `products`, `products/:id`, `images/:assetId`, `sitemap`) is public and
  read-only. It names the shop by code and takes nothing else from the request; it only shows what
  `catalogue_public` holds and answers 404 for anything else, including a hidden product's photo. Its replies are
  `public, max-age=60` (photo redirects 240 s, under the 300 s download grant).
- Guest checkout (Day 32): `GET /shop/:code/fulfilment`, `POST /shop/:code/cart` (`public` budget) and
  `POST /shop/:code/orders` (`checkout` budget, Turnstile when configured) name the shop by code only. The browser
  makes one random checkout key per visit; the order stores only its SHA-256 (unique), so the same key returns the
  same order instead of a second one. `GET /shop/:code/orders/:id?t=key` answers only when the key's digest matches
  that order (404 otherwise, on the `public` budget), so an order id alone never shows a name, phone or address.
  The `order.place` audit row masks `customerPhone` by key name. A signed-in session only links the account.
- Branch fulfilment (`GET`/`PUT /branches/:id/fulfilment`) needs `branch.read`/`branch.write`, keeps a scoped member
  to their own branches and answers 404 for another shop's branch.
- Product photos follow the asset rules: jpeg, png or webp up to 2 MB, a direct-upload grant for
  `product.write`, and the stored bytes checked against the registered size and SHA-256 before the product links
  them.

## Secrets

- `SHOPPER_AUTH_SECRET` and `SHOPPER_LINK_SECRET` must be at least 32 bytes, or the runtime answers `503`
  rather than signing anything with a weak key.
- Cloud secrets are Worker secrets (`cf workers secrets update`); the box keeps them in its sealed config.
- `vp run guard` fails when a `.dev.vars` or `.env*` file is tracked (`.example` files hold placeholders). It
  also fails when a key named `…SECRET`, `…TOKEN`, `…PASSWORD` or `…_KEY` gets a written value in an app's
  deploy config. Test: `tooling/guard/secrets.test.ts`.

## The till's local database

- Every installed register opens SQLCipher with a 32-byte key. On Electron the key is sealed by
  `safeStorage` (DPAPI on Windows) next to the device token.
- A standalone host install without `databaseKey` refuses to start. Only `plaintext: true` opens a plain
  file, and that is for development and tests. Enrolment configs carry no key: Electron seals one after
  enrolment.
- Test: `till/storage/encryption.test.ts`. A wrong key or no key cannot read the file, and its header is not
  `SQLite format 3`.

## Tenant isolation

- There is no row-level security. Every query takes `orgId` from the principal, never from the request.
- `tests/integration/security/tenant/sweep.test.ts` is the proof:
  - It lists every route the API mounts from `createApi(...).routes`.
  - It calls each one as shop A's owner with each of shop B's ids in the path, the query and the body. The ids
    come from every table that has an `org_id`.
  - A response may never show another B id or B's sentinel name, and a `2xx` may never serve the B id it
    was given.
  - Nothing may answer with a `5xx`, except a `503` from a service the test runtime leaves off (`UNAVAILABLE`).
  - B's rows must hash the same before and after, and A's rows may not reference B.
  - A's cookie naming B must be refused everywhere except the public routes.
- **The sweep finds every new route by itself.** A new write whose input an id-only body cannot pass fails the
  sweep until it has an entry in `tests/support/security/bodies.ts`, or `till.ts` for a register upload.
  The entry must be a valid body with the other shop's id in every reference and a fresh id for what it creates.
  A route that is public on purpose goes in `PUBLIC`, with the reason in review.

## Personal data in the audit log

- The audit log is append-only and hash-chained, so what goes in cannot come out. `redact()` in
  `packages/audit/src/chain.ts` runs on every payload, `before` and `after`, on both Postgres and SQLite:
  - secrets (PIN, password, token, OTP, ID and card numbers) become `[REDACTED]`
  - phones, MSISDNs, WhatsApp and MoMo numbers, TINs and Ghana Card numbers keep only their last four:
    `••••••7654`
- Fields are matched by key name, so new commands are covered without opting in. Name a field for what it
  holds (`phone`, `tin`, `ghanaCard`) and it is masked.
- The record tables keep the full values.
- Logs carry `{ event, orgId, id, error }`, never request bodies, emails or phones.
- Test: `security/pii.test.ts`.

## Dependencies

- CI runs `vp pm audit --production --level high`.
- A high or critical advisory is fixed by bumping the direct dependency. When a parent holds the package
  back, add a pinned override in `pnpm-workspace.yaml`, set to the first patched release.
