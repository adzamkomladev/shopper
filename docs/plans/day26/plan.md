# Day 26 · Security hardening

## Context

Notion row "26 · Security hardening" (phase 4 · Harden & pilot, Security + API, Fri 30 Oct, P0).
**Done when:** no endpoint leaks across orgs, proven by test. Required tests: a tenant-isolation sweep, and
lockout after N failed PINs with unlock by a manager.

Tasks on the row:

1. PIN lockout and API rate limiting
2. Session hardening, CSRF, secure cookies, secrets kept in `wrangler secret`
3. Review SQLCipher key handling: the local DB must be unreadable without the key
4. Tenant-isolation sweep: call every endpoint with another org's IDs
5. Dependency audit, plus a PII review of logs and audit payloads

**What exists today:**

- **Lockouts:**
  - PIN and password lockout is already row-based in PostgreSQL: 5 failures lock for 15 min
    (`packages/auth/src/devices/{login,password}.ts`).
  - The till host has its own offline lock (`core/src/till/staff.ts`, `MAX_FAILURES`/`LOCK_MS`).
  - **Nothing unlocks early.** No manager unlock exists, on the server or on the till.
- **Rate limits** are in-memory per isolate, so they are bypassed once traffic spreads across Workers:
  - `api/src/middleware/public/auth.ts` (`allowPublicAuth`), used by onboarding, invitations and statements
  - Better Auth `rateLimit: { storage: "memory" }` (`auth/src/session/better/auth.ts`)
- **CSRF:** `serveRuntime` refuses a mismatched `Origin` on unsafe methods. A request with **no** Origin still
  gets through.
- **Cookies:** Better Auth defaults, with no explicit Secure, SameSite or lifetime policy. There are no
  security headers.
- **SQLCipher:** the Electron app seals a random 32-byte key with DPAPI (`apps/till/electron/src/secrets.ts`).
  `openTillDatabase` still opens a **plain** file whenever no key is passed.
- **Tenancy:**
  - There is no row-level security. Every query relies on `principal.orgId`.
  - The two-org fixture lives in `tests/integration/auth/setup.ts`.
  - Today's isolation tests cover only a few list routes.
- **Audit:** payloads copy full phone numbers, Ghana Card numbers and TINs into the hash-chained,
  append-only log.

**Your decisions (30 Oct):**

- **Rate limiting:**
  - Cloud uses **Cloudflare's built-in Rate Limiting binding**.
  - The box uses an **in-process fixed-window limiter**. The box is one Bun process, so the count is exact
    there. The Rivet `RateLimiter` actor replaces it on day 36 along with the other twins, marked with a
    `ponytail:` comment.
  - Both sit behind a new `RateLimiter` port with conformance tests. That is better than counting in the
    Cache port: Cache cannot do an atomic get-then-put, and it forbids read-after-write in a request.
- **PII in audit:** Ghana Card numbers, TINs and phone numbers are **masked to the last 4** in audit payloads.
  The record tables keep the full values. Secrets are never written.

**How I work:**

- One session on Opus at medium effort, with **no subagents**. That overrides CLAUDE.md's planner and
  reviewer agents; I run their skills inline.
- Skills:
  - `tdd-slice`
  - `cloud-box-parity`, plus `cloudflare`/`workers-best-practices` and `cf docs search` for the
    rate-limit binding
  - `ui-screen`
  - `ui-verify` (playwright-cli at 1920, 1440, 1366, 768, 390 and till size)
  - `pre-merge-review`
- MCPs:
  - Figma: `367:1758` "Login · Locked", plus `12:66`, `45:852` and `173:3087`
  - context7, for the Better Auth cookie and trustedOrigins options
  - Cloudflare docs
  - Notion, for the closing remarks
- **Codex** reviews each slice and the whole branch:
  `codex review --uncommitted -c model="gpt-6.1-sol" -c model_reasoning_effort="medium"`.
- **Tests come first** and must be meaningful. I break each fix once on purpose to watch its test fail.
- **Git:**
  - Branch `day26-security` from `main@9a996aa`, one commit per slice, one push at the end, then a PR.
  - I watch CI with the ccd_pr tools, fix and re-push on failure, then merge once it is green.
  - No AI attribution.
- **Data is disposable.** I reset the dev, e2e and CI databases freely. Migration `0034_security.sql` is
  additive.

## Slices

### S1 · RateLimiter port (cloud + box) replaces every isolate-local limiter

- **Port** (`packages/ports/src/types.ts`):
  - `RateLimiter.limit(policy, key): Promise<boolean>`.
  - A fixed policy table: `auth` 10/60 s, `public` 30/10 s, `enrol` 10/60 s, `cashier` 20/60 s.
  - Keys are `ip:operation`, or `org:ip` for enrolment.
- **cf adapter** (`adapters/cf/src/ratelimit.ts`):
  - One `ratelimits` binding per policy in `apps/edge/cloudflare.config.ts` (`RATE_AUTH`, `RATE_PUBLIC`,
    `RATE_ENROL`, `RATE_CASHIER`), using cf/config's `RateLimitBinding`.
  - Wire them through `adapters/cf/src/runtime`.
- **box adapter** (`adapters/box/src/ratelimit.ts`): an in-process fixed window with an injected clock and a
  bounded map, wired into `apps/box`.
- **Conformance** (`packages/conformance/src/cases/ratelimit.ts`):
  - The limit is honoured, and the call after it is refused.
  - Keys are independent.
  - The window resets.
  - It runs against both adapters.
- **`serveRuntime`:**
  - Takes `options.rateLimiter` and gates `/api/auth/{sign-in,sign-up,forget-password,reset-password}*`,
    onboarding POSTs, invitation accept, `/public/statements`, `/cashiers/login`, `/devices/enroll` and
    `/orgs` lookup.
  - The answer is a `429` with `Retry-After`.
  - With no limiter configured it **fails closed** with a 503.
  - Delete `allowPublicAuth` and set Better Auth's `rateLimit` to `enabled: false`, so there is one mechanism.
- **Tests** (`tests/integration/security/ratelimit.test.ts`):
  - The (N+1)th sign-in or cashier login from one IP gets a 429, and another IP still passes.
  - A runtime without a limiter answers 503 on those routes.
  - The existing tests that relied on `trustedIP()` rotation keep passing.

### S2 · Manager unlock (server + backoffice + till)

- **Migration `0034_security.sql`:** adds permission `staff.unlock`, granted to every role that holds
  `cashier.pin.assign`. Permissions stay data. Add it to `auth/src/schemas/permissions.ts`.
- **Command `staff.unlock`** (`auth/src/devices/unlock.ts`, through `defineCommand`):
  - Clears `cashier_pin.{attempts,lockedUntil}` and `user.{passwordAttempts,passwordLockedUntil}` for a user
    in the caller's org.
  - Audits the before and after lock state.
  - An unknown user or one from another org is a 404.
  - It respects branch scope.
  - Route: `POST /users/:id/unlock`.
- **The users list** exposes `lockedUntil` (the later of the PIN and password locks).
- **Backoffice** (`screens/users/screen.tsx`, `components/users/`):
  - A "Locked until 14:35" badge.
  - A row action **Unlock** (shortcut `U`) with a confirm dialog, and success and error states.
- **Till**, from Figma `367:1758`:
  - The locked notice reads "Too many attempts. Try again at 14:35."
  - Next to it, a **Manager unlock** button (Mod+U) opens the existing approver fields
    (`components/approval/fields.tsx`).
  - Host request `session.unlock` → `approve(..., permission "staff.unlock")` → a new sqlite command
    `unlockStaff` in `core/src/till/staff.ts`, audited.
  - Make sure approver sync carries the new permission.
- **Tests:**
  - `tests/integration/security/lockout.test.ts`:
    - 5 wrong PINs lock the account.
    - A cashier gets 403 on unlock, and the other org's admin gets 404.
    - The admin's unlock lets the correct PIN in at once.
    - The audit row has no secrets.
  - Till host test: an offline lock, a wrong approver PIN refused, an approver without `staff.unlock`
    refused, then a manager unlock followed by a successful sign-in.
  - Playwright: the backoffice Locked badge goes away after unlock, and the till locked state unlocks.

### S3 · Sessions, CSRF, cookies, headers, secrets

- **Better Auth:**
  - `advanced.useSecureCookies` when the base URL is https.
  - `defaultCookieAttributes { httpOnly, sameSite: "lax", secure }`.
  - `trustedOrigins: [baseURL origin]`.
  - Explicit `session.expiresIn` of 12 h.
- **CSRF** in `serveRuntime`:
  - An unsafe method carrying a session cookie must have `Origin` equal to the base URL, or
    `Sec-Fetch-Site: same-origin`. Otherwise it gets a 403.
  - Device bearer calls without a cookie and the webhooks are exempt.
- **Security headers middleware** (`api/src/middleware/headers.ts`):
  - `nosniff`, `Referrer-Policy: no-referrer`, and `Cache-Control: no-store` on authenticated responses.
  - HSTS when https.
  - `frame-ancestors 'none'` in the portal and admin `_headers`.
- **Secrets:**
  - The edge refuses to serve (503) when `SHOPPER_AUTH_SECRET` or `SHOPPER_LINK_SECRET` is missing or shorter
    than 32 bytes.
  - A guard rule fails when `.dev.vars`/`.env*` is tracked, or when a secret name gets a literal value in
    `cloudflare.config.ts`.
- **Tests** (`tests/integration/security/session.test.ts`):
  - The cookie flags are right.
  - A cross-site POST and a POST without Origin are both refused when a cookie is present.
  - A same-origin POST and a device bearer POST pass.
  - The session expires.
  - Sign-out revokes the session on the server.
  - Weak secrets get a 503.
  - The guard rule is seen to fail on a fixture.

### S4 · SQLCipher review

- `openTillDatabase` refuses a keyless open unless it is given the explicit `plaintext: true` used by
  dev and tests. The host runtime passes plaintext only when not packaged.
- Fill only the gaps in `tests/integration/till/storage/encryption.test.ts`:
  - The file header is not `SQLite format 3`.
  - A wrong key or no key raises `TillDatabaseKeyError`.
  - The host refuses to start without a key.
  - The key never appears in `register.json`.
- Write the review in `verification.md`.

### S5 · Tenant-isolation sweep (the done-when proof)

- `tests/integration/security/tenant/sweep.test.ts`, with seeding in `tests/support/security/tenants.ts`:
  - **Setup:** a full `serveRuntime` with two provisioned orgs, each seeded with one of every entity: store,
    branch, product, category, supplier, price, customer, device, shift, golden sale, stock take, PO, approval,
    KYC case, KYB case, role, user, invitation and transaction.
  - **Every route is classified:** the test enumerates every route from the Hono app (`app.routes`). Each must
    be classified in an explicit table (resource → org B id, or public, or exempt with a reason). **An
    unclassified route fails the test**, so new endpoints cannot skip the sweep.
  - **Org B's IDs, as org A:** for every route, org A's superadmin calls it with org B's IDs in the path and in
    the body fields (`branchId`, `productId`, …). It expects a 4xx, and no org B id or name sentinel in the
    response.
  - **Org B's selector:** `X-Shopper-Org: B` with A's cookie is refused.
  - **Lists:** every list route as A contains no B sentinel.
  - **Org B is untouched:** its audit_log row count and a digest of all its rows are identical before and
    after.
- Every leak it finds is fixed where it starts, in the shared query or command, with a 404 for foreign ids.

### S6 · PII and dependency audit

- **Masking:**
  - Add `maskTail(value, 4)` to `@shopper/utils`.
  - Apply it in the `audit()` of customer, KYC, KYB, org tax/TIN and user commands, for phones, Ghana Card
    numbers and TINs.
  - Make sure OTPs, document URLs, tokens and hashes are never audited.
  - Review the 56 `console.*` sites; none may log bodies, emails or phones.
- **Test** (`tests/integration/security/pii.test.ts`):
  - Run those commands with canary values.
  - Scan `audit_log` payload, before and after: the full canaries and secrets are absent and the last 4 is
    present.
  - `verifyChain` still passes.
  - Update the tests that pinned full values.
- **Dependencies:**
  - `pnpm audit --prod`, and bump to fix every high or critical finding.
  - Add a CI step `pnpm audit --prod --audit-level=high`.
  - List what remains in `verification.md`.

### S7 · Docs and close

- `docs/engineering/security.md`, new:
  - the limiter policies
  - CSRF, cookies and headers
  - the unlock flow
  - the sweep and how to classify a new route
  - PII masking
- `platforms.md`: the RateLimiter binding and the box twin.
- `AGENTS.md`: two rule lines.
  - Every new route must be classified in the tenant sweep.
  - Audit payloads mask Ghana Card numbers, TINs and phones.
- `docs/plans/day26/{plan,verification}.md`, with screenshots.
- Push, PR, CI to green, merge, pull `main`.
- Update the Notion Day 26 row: set Status to Done, tick the checkboxes, and add a Remarks section in the
  Day 25 format.

## Verification

- `vp check`, `vp run guard`, and `vp test --run` across all integration suites, with conformance against both
  adapters.
- `vp run e2e` for the new lockout specs.
- The `ui-verify` loop on the backoffice users screen and the till sign-in locked/unlock states at every size:
  console clean, no overflow, keyboard path (U, Mod+U, Esc, Enter).
- Manual: `cf dev` edge, curl a cross-site POST (403), burst sign-ins (429), weak secret (503).
- Codex review is clean on every slice and on the whole branch. PR CI is green before merge.
