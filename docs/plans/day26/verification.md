# Day 26 verification

The rules these slices set are written up in [security.md](../../engineering/security.md).

## S1 · RateLimiter port

### What changed from the plan

- `auth` is 5 per 10 s, not 10 per 60 s. Cloudflare's binding counts only in 10 s or 60 s windows, and a short
  window stops a burst sooner.
- Account keys carry the shop and the email, so spreading guesses over many addresses buys nothing.

### Tests

- `security/ratelimit.test.ts`:
  - the 6th sign-in or cashier login from one IP is 429 with `Retry-After`, and another IP passes
  - a runtime with no limiter is 503
- Conformance runs the window, independent keys and the reset against the Cloudflare and box adapters.

## S2 · Manager unlock

### Tests

- `security/lockout.test.ts`:
  - 5 wrong PINs lock the cashier, and the 429 names `lockedUntil`
  - a cashier is refused on unlock (403), and another shop's admin gets 404
  - the admin's unlock lets the right PIN in at once
  - the audit row holds failure counts, never a PIN
- `e2e/till/ui/signin/unlock.spec.ts` (9 tests): the locked notice, Ctrl+U, a wrong manager PIN, no
  managers, approvers failing to load, focus coming back, and sign-in after unlock.
- `e2e/portal/users/unlock.spec.ts`: Locked until, confirm, the badge cleared, and the PIN accepted.

### Review fixes (Codex `gpt-6.1-sol`)

- The lockout deadline did not reach the till, so it now comes through the 429.
- Focus was lost when the dialog was cancelled. It now returns to Manager unlock, or to the email field once
  the lock is gone.

## S3 · Sessions, cross-site refusals, headers, secrets

### What changed from the plan

- Better Auth already sets `__Secure-`, Secure, HttpOnly and SameSite=Lax over https, so the test pins those
  flags instead of setting them again.
- A write with no `Origin` passes only with `Sec-Fetch-Site: same-origin` or with no cookie at all.

### Tests

- `security/session.test.ts` (7 tests):
  - the cookie flags
  - a cross-site write and a write without Origin carrying a cookie are both refused
  - same-origin and bearer writes pass
  - the headers are set
  - the session expires and sign-out revokes it
  - a weak secret gets 503
- `tooling/guard/secrets.test.ts`: a tracked `.dev.vars` and a literal secret in a deploy config fail, including
  one passed through `bindings.text`.
- `tooling/cloudflare/portal.test.ts` pins the `_headers` files.

### Review fixes

- The Bun live test and the API runtime test now send Origin the way a browser does.
- Secrets passed through config helpers are caught.

## S4 · SQLCipher review

### Findings

- Electron seals a random 32-byte key with `safeStorage` beside the device token. A wrong key or no key cannot
  read the file, and its header is not `SQLite format 3`.
- The gap: a host config without a key opened a plain database without a word. A config must now carry
  `databaseKey`, or name `plaintext: true` for development and tests. A standalone install without a key exits
  before it spends an enrolment code.
- Enrolment configs carry no key, because Electron seals one only after enrolment. That path is unchanged.

### Tests

- In `till/storage/encryption.test.ts`:
  - a keyless start is rejected and creates no file
  - a spawned plaintext host works
  - a standalone install with no key exits 1, naming `databaseKey`

## S5 · Tenant-isolation sweep (the done-when)

### How it proves it

- `security/tenant/sweep.test.ts` runs two shops on one cloud runtime with every optional service switched on:
  KYC, KYB, invitations, onboarding, approvals, MoMo and blobs. Shop B owns one of most things: a store,
  branch, category, supplier, four products with barcodes and stock, a price, a customer, a till and a PIN,
  each named `SENTINEL-B`.
- Every route `createApi` mounts is called as A's owner, and the till routes from A's own register, once for
  each of B's ids. The ids are taken from every table that has `org_id`, and each goes into the path, every
  reference field of the query, and a schema-valid body.
- The test fails when:
  - a response shows the sentinel or another of B's ids
  - a `2xx` read serves B's id
  - anything answers `5xx`, except a `503` from a service the runtime leaves off: Hubtel, the settlement
    workflow, the PDF renderer, and presigned uploads (filesystem blobs never take client files)
  - B's rows hash differently afterwards
  - A's rows point at B
- Till uploads are real events that claim A's own shop, register and session and point every reference at B.
  Each ends at a shop check:
  - a customer update or account payment for B's customer: not found
  - a refund of B's sale: "Original sale not found in this store"
  - a stock receipt of B's product: "unknown product"
  - an offline session whose parent is B's: not adopted
  - an audit row claiming B's shop: scope
- A write that still stops at input validation, or whose event is refused as malformed, fails the test unless:
  - `ELSEWHERE` names the test that proves it, and the sweep checks that test exists by its title. That covers
    `/sync/push`, whose sale needs a full basket (`sync/authentication`: cross-tenant product references), and
    `/sync/shifts` (`shifts/accept`: a shift for another organisation).
  - It is pre-shop onboarding, which has no org.
- Rows A creates get fresh ids. The test asserts A ends up holding none of B's ids, and that no row of A's points
  at B.
- A's cookie naming B as the shop is refused on every list route except the public ones. B's own owner does see
  the sentinel, as a positive control.

### Defects found

- `GET /public/statements/:token` and any unhandled method on `/tax/returns/*`, `/tax/fiscal/archives` and
  `/audit/streams|verify` crashed with 500:
  - the statements router's `use("*")` ran on every route once mounted at `/`
  - `requireOrgWide`, mounted with `use()`, ran with no principal
  - both now attach only to the routes they guard
- No route showed or changed another shop's data.
- A register may ask for refund approval naming any sale id, and `approval_request` keeps it as written. The sale
  may not have synced yet, so the id is not checked at that point. The refund itself is checked against A's shop
  when it arrives, and the sweep's own refund of B's sale is refused. This is the one table allowed to hold
  another shop's id.

### Review fixes

- Codex found, in two passes, that the sweep proved less than it claimed:
  - id-only bodies stopped at validation
  - optional services were off
  - empty or malformed sync events never reached a check
  - a global exemption for ids A had reused could hide a leak
- Now every body is schema-valid per route, every service is on, A has a till, sync events are real, each leak
  signal is checked on its own, and a write that never reaches a check fails the test.
- A third pass found:
  - writes tried only one of B's ids
  - the audit row's hash was zero, so it stopped at the chain check
  - the offline session used a made-up proof
  - every `503` was allowed
- Now writes try every id of B's, the audit row is hashed correctly, the offline session carries B's real
  session and proof, and only the named services may answer `503`.

### Remaining

- A sale pushed through `/sync/push` naming B's product is proven by `sync/authentication.test.ts`, not by the
  sweep itself, because a sale needs a full basket with tax and tenders.

## S6 · PII and dependency audit

### What changed from the plan

- No `maskTail` helper. `redact()` in `@shopper/audit` already ran on every payload, `before` and `after`, on
  Postgres and SQLite, so masking lives there, keyed by field name: phones, MSISDN, WhatsApp, MoMo numbers, TIN
  and Ghana Card. A new command is covered without opting in.
- KYC already stored only a fingerprint and a mask, and payments already masked the phone.

### Tests

- `security/pii.test.ts`:
  - a customer's phone and TIN, and the shop TIN, reach the log as their last four, while the customer row
    keeps them whole
  - every spelling, nested and in arrays, is masked
  - `verifyChain` still passes
  - with the mask switched off, both tests fail

### Logs

- All 28 `console.*` sites log `{ event, orgId, id, error }`.
- The back-office client already withholds bodies on sensitive paths.
- No thrown error interpolates a recipient.

### Dependencies

- `pnpm audit --prod` found 7 high and 8 moderate advisories, all fixed:
  - Valibot 1.1.0 → 1.5.0 across 17 packages (ReDoS)
  - Electron 44.5.1 → 44.9.2
  - overrides for undici 7.30.1, seroval 1.6.12, zod 4.6.7 and fflate 0.7.5, which their parents hold back
- The audit now finds no known vulnerabilities, and CI runs `vp pm audit --prod --audit-level=high`.

## Screenshots

`screenshots/`:

- till sign-in, locked and unlocking, at 1920, 1366, 1024, 768 and 390
- the wrong manager PIN
- approvers failing to load
- back office Users, Locked until with the Unlock action (`portal-users-locked-*`), at 1440, 1366 and 390
