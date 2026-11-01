# Day 30 · Shop app and customer accounts

## Context

Day 30 in Notion ("30 · Shop app + customer accounts", Phase 5 · Customer apps) asks for:
`apps/shop` as TanStack Start SSR on Workers sharing `@shopper/ui`; phone sign-in with an Arkesel OTP; an
account area (purchase history, digital receipts from R2, loyalty balance, profile, delivery addresses); and
online-order receipts rendered once with Browser Run when paid, stored in R2 and never re-rendered on view.
**Done when an in-store customer can see their receipts online.** Day 29 (live setup) is skipped for now.

Today `apps/shop` is a Day 1 stub (one `About` route, a bare `wrangler.jsonc`). Main is at `f2b2ab3` (Day 28
merged); work happens on a new branch `day30-shop` from it. Data is disposable: any reset is fine.

Decisions (agreed):

- **Shop URL is a path:** `/<shop code>/…` (the org `slug`, the same "shop code" staff already use).
- **Render-once is built today** as a core command; Day 33's order payment is its caller.
- **A phone with no customer record still gets an online account** (empty receipts and points until a cashier
  attaches that phone at the till).
- **Profile edits change the online account only**; the `customer` row (what tills sync) is untouched.
- **No new dependency:** the code step is one `Input` with `inputMode="numeric"` and
  `autoComplete="one-time-code"`, not `input-otp`.

Figma: no customer-shop frames exist. The shop takes the **Componets** page (12:66) tokens and primary teal
and the **New Login** row's states (173:3087: default, filled, disabled, loading, error, warning) as its
source, then gives them a bolder consumer treatment (see "The shop's own look"). Pull exact token values with
`get_design_context` while building.

## How it works

```
browser ──/<code>/…──▶ apps/shop (Start SSR)  ──/api/shop/*──▶ API binding (shopper-edge) ──▶ @shopper/api /shop routes
                       └ loaders: server fns forward the cookie to the same API
```

- The shop Worker serves pages and forwards only `/api/shop/*` to the API (service binding `API` on
  Workers, `SHOPPER_API_URL` on the test host). The session cookie is first-party to the shop origin.
- **Org resolution:** sign-in routes name the shop code in the path (public, like `/orgs/:slug`). Every
  `/shop/account/*` route takes its org **only from the session row**, never from the request.
- **OTP**, reusing the KYC pattern (`packages/auth/src/kyc/otp.ts`): the code is derived by HMAC from
  challenge id + send number (never stored), the row keeps a keyed digest, 10 min TTL, 3 sends, 5 attempts.
  The SMS goes out through the notifications queue as a `shop.otp` message carrying only the challenge id and
  send number; the consumer derives the code and sends with `createArkesel`. The reply to "send code" is the
  same whether the phone is known or not.
- **Abuse:** a new `otp` rate policy in `packages/ports/src/limits.ts` (per IP and per shop+phone), wired in
  `packages/api/src/middleware/public/limits.ts`; a Turnstile check on "send code" through an injected
  verifier (cloud shell supplies it; tests use a fake).
- **Session:** random 32-byte token in an `HttpOnly; Secure; SameSite=Lax` cookie; only its SHA-256
  (`@shopper/utils`) is stored; 30-day expiry; sign-out revokes.
- **What an account sees:** sales of every customer row at that shop with the account's phone (rows merged
  away follow their survivor), points summed across those rows with the ledger entries, tier when loyalty is on.
- **Receipts:** the purchase page renders the stored `sale.receipt` JSON with the shared `ReceiptView`
  (`packages/hardware/src/receipt/view`), and "Download PDF" redirects to a 60 s `blobs.createDownload`
  grant when `sale.receiptAssetId` is linked. The API never renders on view.
- **Render-once (for online orders):** `renderSaleReceipt` in `packages/core/src/receipts/` — if the sale
  already has a linked receipt asset, it returns it without rendering; otherwise `renderer.receipt(…, "pdf")`
  (Browser Run via `cloudflareRenderer`, Satori via the box renderer), `blobs.put` to `receipts/<saleId>.pdf`,
  then one audited command inserts the verified `asset` (purpose `sale_receipt`) and links the sale under a
  row lock.

## Data (one forward migration `0036_shop.sql`)

- `shop_account`: org_id, id, phone (unique per org), name, email, timestamps.
- `shop_login`: org_id, id, phone, otp_digest, expires_at, sends, attempts, verified_at.
- `shop_session`: org_id, id, account_id, token_digest (unique), expires_at, revoked_at.
- `shop_address`: org_id, id, account_id, label, line1, area, city, landmark, phone, is_default (one per account).
- All UUIDv7 with org_id and composite FKs as in `schemas/customers/base.ts`; Drizzle schemas in
  `packages/db/pg/src/schemas/shop/{accounts,sessions,addresses}.ts`. Every write is a `defineCommand()` with an
  audit row; phones are masked by `redact()` (field names `phone`).

## Slices (tests first, one commit each)

| Slice | What                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Tests written first                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0    | Branch `day30-shop`, `docs/plans/day30/plan.md`, Day 30 row → In progress                                                                                                                                                                                                                                                                                                                                                                                       | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| S1    | Migration + schemas, OTP challenge commands (start, resend, verify, lock, expiry), account creation on first verify, sessions                                                                                                                                                                                                                                                                                                                                   | `tests/integration/shop/signin.test.ts`: code verifies once; wrong code ×5 locks; expired code refused; 4th send refused; unknown phone gets an account; audit chain verifies                                                                                                                                                                                                                                                                                                                                              |
| S2    | `shop.otp` queue message and consumer (Arkesel)                                                                                                                                                                                                                                                                                                                                                                                                                 | `tests/integration/shop/otp.test.ts`: the SMS carries the derived code; no code in the queue message or DB; retry sends the same code                                                                                                                                                                                                                                                                                                                                                                                      |
| S3    | API `/shop/*` routes, runtime routing (`isPublicRequest`, `serveRuntime` like `/public/statements`), `otp` rate policy, Turnstile verifier                                                                                                                                                                                                                                                                                                                      | `tests/integration/shop/routes.test.ts`; `tests/integration/security/tenant/shop.test.ts` (a session of shop A never reads B; a forged/expired/revoked cookie is 401); sweep `PUBLIC` gains only `shop/<code>` and its sign-in routes; rate limit 429                                                                                                                                                                                                                                                                      |
| S4    | Account reads: purchases, receipt detail, PDF redirect, loyalty, profile edit, addresses CRUD                                                                                                                                                                                                                                                                                                                                                                   | **Day's key test** `tests/integration/shop/account.test.ts`: a till sale for a customer phone → OTP sign-in → sees that receipt and its points balance; sale of another phone not listed; PDF answers a short-lived grant only when linked; renderer is never called                                                                                                                                                                                                                                                       |
| S5    | `renderSaleReceipt` render-once                                                                                                                                                                                                                                                                                                                                                                                                                                 | `tests/integration/receipts/render.test.ts`: first call renders, stores and links a verified asset; second call renders nothing; a till-linked receipt is never re-rendered                                                                                                                                                                                                                                                                                                                                                |
| S6    | `apps/shop` with its own look (below): Start routes `/$shop` (redirects to sign-in or account), `/$shop/sign-in`, `/$shop/account` (points card + receipts, "You" sheet), `/$shop/receipts/$saleId`; `/api/shop/*` forwarding; `cloudflare.config.ts` (service binding to `shopper-edge-<stage>`, staging/production domains) replacing `wrangler.jsonc`; e2e host `tooling/build/shop/e2e.mjs` + `tests/support/shop/server.ts`; new Playwright `shop` project | `tests/e2e/shop/signin.spec.ts` (phone → code read from the Arkesel fake → account; wrong code; locked; resend), `tests/e2e/shop/account.spec.ts` (points card, receipts, receipt page + PDF, "You" sheet: address add/edit/delete, profile, sign-out; expired session goes back to sign-in), `tests/e2e/shop/states.spec.ts` (loading, empty, error, unknown shop 404), `tests/e2e/shop/motion.spec.ts` (code auto-submits on the sixth digit; wrong code marks the field invalid; with reduced motion no animation runs) |
| S7    | `/ui-verify` with `playwright-cli` at desktop, laptop, tablet, mobile and till sizes; keyboard path; console and overflow; `/skeleton-audit` on the account skeletons; screenshots in `docs/plans/day30/screenshots/`                                                                                                                                                                                                                                           | screenshots                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| S8    | Docs: `platforms.md` (shop Worker, binding, Turnstile, `otp` policy), `security.md` (customer sessions, OTP), `frontend.md` (shop area), `apps/shop/README.md`; `docs/plans/day30/verification.md`                                                                                                                                                                                                                                                              | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### The shop's own look (customer-facing, not the back office)

The shop must not look like the portal. It is for shoppers on phones: friendly, bold, clean, and doing little.

- **Few screens.** Sign-in (phone → code, one card), **Account home** (a large points card on top, then
  receipts newest first), **Receipt** (the receipt itself plus one "Download PDF" button), and a **"You" sheet**
  for name, email, addresses and sign-out. No tabs, no tables, no sidebar, no filters.
- **Its own theme on the same kit.** `apps/shop/src/styles.css` imports the `@shopper/ui` theme and scopes
  overrides under `[data-surface="shop"]`: radius 1rem (cards 1.5rem), a bolder type scale (display headings
  in Geist 700–800, tight tracking), roomier spacing, a soft tinted background, the Figma primary teal as a
  confident accent with white text, large touch targets (h-12 buttons). Tokens only, no hard-coded colours;
  dark mode follows the existing `data-theme` switch.
- **Components:** `@shopper/ui` primitives (Card, Button, Input, Field, Sheet, Empty, Skeleton, Money, Sonner)
  restyled through the shop scope; shop-only compositions live in `apps/shop/src/components/`.
- **Micro-interactions** with CSS and `tw-animate-css` (already in the kit, no new dependency), all off under
  `prefers-reduced-motion`:
  - buttons press down (scale 0.97) and show an inline spinner while sending;
  - the code field shows six slots that fill as digits arrive, auto-submits on the sixth, shakes on a wrong
    code, and a resend countdown ring runs down;
  - success draws the check (the Day 28 drawn check) before the account slides in;
  - the points number counts up to the balance (the Day 28 tick on totals); the tier shows as a chip;
  - receipts stagger in, lift slightly on hover/focus, and open with a View Transition (the receipt card
    morphs into the receipt page) via the router's `defaultViewTransition`;
  - the "You" sheet slides up on phones; saving an address gives a toast and the row settles in place;
  - skeletons use the kit shimmer and match the loaded boxes (verified with `/skeleton-audit`).
- **Copy** is plain and warm ("Your receipts from Accra Mart", "We sent a code to 024 *** 4567").
- Mobile-first layouts (single column under 640 px, centred max-w-xl column on larger screens); keyboard path
  still complete (Enter submits, Esc closes the sheet, visible focus rings).

Rules kept: no effects (guard), every state designed, money through `formatGHS`. Folder rule:
`apps/shop/src/{routes,components/{signin,account,receipt,you},functions,styles.css}`.

## Workflow (as asked)

- No subagents; I do the work in this session. Skills used inline: `/tdd-slice` per slice, `/ui-screen` and
  `/ui-verify` + `playwright-cli` for S6–S7, `/skeleton-audit`, `/cloud-box-parity` (renderer and queue touch both
  shells), `/pre-merge-review` with `codex review` on `gpt-6.1-sol` before each commit and the PR. Day 28 noted
  Codex quota resets 4 Nov; if it is still out I fall back to `/code-review` and say so.
- MCPs: Figma (design context per frame), Notion (status and remarks), shadcn (component lookups), Playwright MCP
  only as fallback.
- Commit after each slice; push only when everything is done. Then open the PR, watch CI to green (fix and push
  on failure), merge, and fast-forward local `main`.
- Update the Notion Day 30 row: tick tasks, set Status Done, add a Progress section with the PR link, test counts
  and remarks (what is deferred: production deploy waits for Day 29; Turnstile site key and Arkesel sender per stage;
  render-once has its caller on Day 33).

## Verification

- `vp test --run` (integration incl. the new shop, tenant and receipt suites), `vp check`, `vp run guard`.
- `vp run build` builds `apps/shop` for staging and prod modes.
- Playwright: standard, public and new `shop` projects green locally and in CI.
- Break-it checks: drop the org filter on purchases (tenant test fails), skip the attempts counter (lock test
  fails), call the renderer on view (account test fails), render without the linked check (render-once fails).
- Manual: sign in on the e2e host at mobile width with the code from the Arkesel fake and open a till receipt.

## Critical files

- New: `packages/db/pg/migrations/0036_shop.sql`, `packages/db/pg/src/schemas/shop/*`,
  `packages/core/src/shop/*` (or `packages/auth/src/shop/*` for OTP/session, next to KYC),
  `packages/core/src/receipts/render.ts`, `packages/api/src/routes/shop/{signin,account}.ts`, `apps/shop/**`,
  `apps/shop/cloudflare.config.ts`, `tests/integration/shop/*`, `tests/e2e/shop/*`, `tests/support/shop/*`.
- Changed: `packages/api/src/runtime.ts`, `packages/api/src/app.ts`, `packages/api/src/types.ts`,
  `packages/ports/src/limits.ts`, `packages/api/src/middleware/public/limits.ts`,
  `packages/core/src/notifications/deliver.ts`, `packages/adapters/cf/src/runtime.ts` (Turnstile, binding),
  `tests/integration/security/tenant/sweep.test.ts`, `playwright.config.ts`, docs listed in S8.
- Reused: `otpCode`/`otpDigest` pattern, `constantTimeEqual`, `createArkesel`, `readLoyalty`, `listCustomerSales`
  shape, `Blobs.createDownload`, `Renderer.receipt`, `cloudflareRenderer`, `ReceiptView`, `findOrgBySlug`,
  `tooling/arkesel/server.ts` fake.
