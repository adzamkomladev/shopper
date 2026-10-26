# Testing

Only integration and end-to-end tests. No unit tests. Every test drives real components that talk to
each other: real PostgreSQL 18, real workerd, real adapters, real printer bytes, a real browser.

## Tests come first

For every feature or fix:

1. **Write the plan as tests.** List the behaviours the change must produce, as test names, before
   any implementation. This list is part of the plan (see the `feature-plan` skill).
2. **Write the failing tests.** Run them and watch them fail for the expected reason: a missing route,
   a wrong total. A test that fails because of a typo or a missing import has not proved anything yet.
3. **Implement the smallest change that makes them pass.**
4. **Run the whole suite**, then `vp check` and `vp run guard`.

A bug fix starts with a test that reproduces the bug. A day's work is done when its tests are green
in CI.

## Tests that prove something

A green test is evidence only if it would go red on the wrong code.

- **Assert the requirement, not the shape.** `total >= 0` or "`save` was called" accepts almost any
  wrong answer. Assert the exact amount, the rows written and the audit chain.
- **Test the failure and the timing.** Make a dependency reject and assert the error reaches the
  caller. Hold a write pending and assert the operation has not resolved yet.
- **Break it on purpose.** Before calling a test done, introduce the likely bug (return before the
  writes finish, swallow the rejection, allow one extra retry, drop a tax line) and watch the test
  fail. Revert. If it stays green, the test is too weak.
- **Tests come from the behaviour, not the implementation.** The `test-author` writes them from the
  plan and the public interface. The implementer does not edit them to get green; a test that is
  wrong is reported, and the fix is reviewed as a test change.
- **Changes that make checks easier to pass are suspect.** Reviewers read every diff to tests,
  fixtures, golden files, test config, `tooling/guard.ts` and its baseline as closely as product
  code: a loosened assertion, a widened tolerance, a new skip, a verifier that always passes.

## Layout

```text
tests/
  package.json                @shopper/tests: declares every package the suites import
  fixtures/                   shared data and environments (postgres.ts, golden sales, receipts)
  support/                    shared helpers: builders, API clients, login, clocks
  integration/<area>/         Vitest, run by `vp test`
    api/  audit/  auth/  core/  db/  edge/  hardware/  ports/  tax/  tooling/
  e2e/<app>/                  Playwright user flows per app: portal/, shop/, till/ui/
tooling/worker/tests/         Workers runtime suite (Vitest 4 + Cloudflare plugin, reading `apps/edge/cloudflare.config.ts`), invoked from
                              tests/integration/edge/worker.test.ts
```

- Name files after the behaviour area: `integration/sales/split-tender.test.ts`, not `sales2.test.ts`.
- Name tests after the observable outcome: `"a voided line is excluded from the Z-report tax total"`.
- 250 lines per test file (guard). Split by scenario and move setup into `tests/support/`.
- Import packages by name (`@shopper/core`), never `../../packages/...` (guard). Add the package to
  `tests/package.json` when a suite first needs it.
- `tests/integration/tooling/guard.test.ts` covers the repository guard itself.

## What every integration test uses

- **A fresh PostgreSQL 18 database per suite** via `postgresFixture()` in
  `tests/fixtures/postgres.ts`, migrated with `migrateDatabase()`. It is dropped afterwards. Never
  share state between files: Vitest runs files in parallel, in three groups (`vite.config.ts`):
  `integration` (4 wide), then `heavy` (2 wide: CPU-hungry files and ones that assert a time budget
  or an upload interleaving), then `solo` (release builds that rewrite a shared `dist/`). Add a file
  to `heavy` or `solo` only for those reasons, never to hide a race.
- **Spawned apps are prebuilt.** `tests/support/prebuild.ts` bundles the till host, Electron and the
  box once per run. A suite never rebuilds into a shared `dist/`: another file may be running from it.
- **Real commands.** Change data through `defineCommand()`, the API, or the till-host, exactly as
  production does. Then assert on the rows, the audit chain (`verifyChain`), and the HTTP response.
- **Both adapters for anything behind a port.** Conformance suites live in `packages/conformance`
  and run against `adapters/box` (in `tests/integration/ports`) and `adapters/cf` (in
  `tooling/worker/tests`). A port change without both green is not done.
- **Golden sale fixtures** for money and tax. A trading day of sales runs through the full sale path
  and must match the stored expected totals to the last 1/10000 of a cedi. Changing a golden file
  needs a written reason in the PR.
- **Time is injected**, never read from the wall clock inside logic (`now = Date.now` parameters, as
  in `boxCache`). Workflows are tested by advancing time, not by sleeping.

## What is never done

- Mocking our own modules. If a test needs to replace our code to pass, the code needs a port.
- Mocking the database. Use the PG18 fixture.
- Snapshot tests of large objects. Assert the fields that matter.
- `test.skip`, `.only`, or retries to hide a flaky test. Fix the race.
- Asserting on log output or private functions.

Third-party HTTP (Paystack, Hubtel, Arkesel, Maileroo, GRA E-VAT) is replaced at the network edge with
a local fake server in `tooling/` that speaks their real contract. The client code under test is
unchanged.

## End-to-end (Playwright)

Add `@playwright/test` with the first UI flow, under `tests/e2e/<app>/*.spec.ts`. Every screen ships
with an e2e test that covers:

- the main task done with the **keyboard only** on the till (every action has a shortcut),
- the empty, loading, error, and offline states,
- an accessibility check (`@axe-core/playwright`, no serious violations),
- a screenshot at the sizes the screen supports: at least till (1366×768), laptop (1440×900) and
  mobile (390×844) for the portal and shop. The manual `ui-verify` pass adds desktop (1920×1080) and
  tablet (768×1024).

Passing tests are necessary but not sufficient: every UI change also runs the `ui-verify` loop in a
real browser with `playwright-cli` (states, keyboard, console, overflow, Figma comparison) before it
is reported done. See [frontend.md](frontend.md#verify-in-a-real-browser-every-frontend-change).

### The harness

`playwright.config.ts` (repo root, `vp run e2e`) starts the real stack: the box binary on Bun (port 3101) against PostgreSQL 18, the portal on 5183 and the till-ui on 5184, all with `--strictPort`. The portal host
(`tests/support/portal/server.ts`) mirrors the Worker: it serves `dist/client` statically with the
`index.html` fallback for document navigations, sends `/api*` to the shared API with box adapters
and only `/_serverFn/*` to the Start bundle. `tests/integration/tooling/cloudflare/{edge,portal}.test.ts` build each Worker
with the `cf` toolchain (`--mode staging`) and check `.cloudflare/output/v0`: bindings, text values,
secret declarations, domains, the prerendered shell and the Static Assets routing, plus the deploy
script's refusal and credential-free `--dry-run`; `tooling/worker/tests/portal.test.ts`
checks the Worker context and API in workerd.
Servers already running are reused outside CI. One worker, no parallelism.

- **Projects:** `setup` (`auth.setup.ts`) runs first. `portal` depends on it and reuses its saved
  `storageState`. `till-ui` has no dependencies.
- **Database:** `tooling/database/e2e.ts` drops, recreates, migrates and provisions the two e2e
  shops (`e2e-mart`, `e2e-annex`) on every start. It refuses any database not named `*_e2e`, and
  any non-local host outside CI, because dropping is irreversible. Override with `E2E_DATABASE_URL`.
- **Helpers** are in `tests/support/e2e.ts`: shop fixtures, `typeCredentials`, `signInWithKeyboard`
  and `expectNoSeriousAxe` (fails on serious or critical axe violations and names the rule and
  target). Domain builders sit beside it (`catalogue.ts`, `import.ts`).
- **The sign-in pacer:** Better Auth allows 3 sign-in or sign-up requests per IP, in a chain that
  only restarts after a 10 s gap, and the dev proxy gives every browser the same IP. Call
  `waitForAuthSlot()` before every request that signs in or up. It counts in a file because each
  project runs in its own worker. Never raise or disable the limit for tests.
- **Fault injection:** `page.route` may fake only a response the real API cannot produce, such as
  an unreadable 2xx. Never use it to fake a feature, a data set or a happy path.

E2E tests use roles and labels (`getByRole("button", { name: "Charge" })`), never CSS classes or
test IDs, unless no accessible name exists, and then the missing name is the bug.

## Electron under Xvfb

Electron suites (`tests/integration/hardware/render/electron.test.ts`, `equivalence.test.ts`) start
the real binary through `tests/support/hardware/electron.ts`, on the Electron main and till host that
`tests/support/prebuild.ts` built, and runs `xvfb-run -a electron --no-sandbox --disable-gpu dist/main.js` when `DISPLAY` is
unset. `--disable-gpu` is required under Xvfb: with GPU compositing `capturePage` fails with
`UnknownVizError`. Render-only mode (`SHOPPER_ELECTRON_RENDER_ONLY=1`) answers `render` messages over
the child's Node IPC channel and starts no host.

`equivalence.test.ts` renders the golden receipt with Electron and with `boxRenderer()` and compares
them: both 576 px wide, heights within 8 px, `pixelmatch` (threshold 0.2) differing on at most 2% of
pixels. The constants at the top of the file are calibration knobs. Set `SHOPPER_RENDER_DIFF_DIR` to
write both PNGs and the diff image. Receipt line heights are whole pixels because Satori rounds
fractional ones up, which drifted the two engines apart by 5 px.

### Desktop register (Day 13)

- Electron now seals the register's secrets on every start, so suites pass `--user-data-dir=<temp>`
  and `--password-store=basic`. On Linux that switch opts in to the plain-text `safeStorage` backend,
  but only in an unpackaged app or with `SHOPPER_INSECURE_SECRETS=1`. `SHOPPER_TEST_NO_ENCRYPTION=1`
  (unpackaged only) forces the "OS encryption unavailable" refusal. DPAPI itself is proven on Windows.
- Serial drivers are tested over a python3 `os.openpty()` pair (`tests/support/hardware/serial.ts`).
  A pty ignores baud and cannot fail a write mid-stream; those paths are checked on real COM ports.
- The Windows spooler driver is tested with a fake shell that records argv, env and stdin. The real
  PowerShell/winspool path runs only on Windows.
- Xvfb 21.1 cannot show Chromium two monitors (`xrandr --setmonitor` is ignored and `+xinerama`
  stacks screens at 0,0), so only the single-monitor customer-display case runs here.
- Under heavy machine load the Electron and host suites hit their "never became healthy" and
  "Host message timed out" limits. Rerun a failing file alone before treating it as a regression.

See [windows-handoff.md](../plans/day13/windows-handoff.md) for what is verified on the till PC.

### Refunds and approvals (Day 14)

- Refund tests build on the golden sale: accept it through `/sync/push`, then refund through
  `/sync/refunds` or the till host (`tests/support/sales/refunds.ts`, `tests/support/till/refunds.ts`).
- Managers come from `memberWithPin(name, role, pin)` (`tests/support/sync/members.ts`), and are synced
  to the till with the helpers in `tests/support/till/approvers.ts`.
- Tests that depend on the return window freeze only `Date` (`vi.useFakeTimers({ toFake: ["Date"] })`),
  so the fixed golden sale date never ages out.
- `tests/support/till/host/upstream.ts` `dropNextRefundResponse()` simulates a reply lost after the
  server accepted.

### Shifts and cash control (Day 15)

- `world(db)`, the till host fixture (`createHostFixture`), `startRegister`, `goldenWorld` and the
  connection host default to an open shift inserted directly (no audit row, so audit counts elsewhere do
  not move). Pass `{ shift: false }` for a closed register.
- Till shift helpers: `tests/support/till/{shifts,cash,close}.ts` (`insertOpenShift`, `sellTenders`,
  `tradeDay`, `declareNow`, `closeNow`, `denominate`). The till host bridge: `startShifter` in
  `tests/support/till/host/shifts.ts`.
- Server side: `shiftEvent`, `edit`, `refigure` and `postShift` in `tests/support/sales/shifts.ts`, and
  the upload fixture helpers in `tests/support/sync/shifts.ts`.
- One session id must keep one content per till database (`host_session`); suites that sell, move cash
  and read reports act as one session (`clerk`).

### Inventory (Day 16)

- Stock seeding: `addMovements`, `addDocument`, `addSupplier`, `setLevel`, `addBranch` and `day` in
  `tests/support/stock/seed.ts`; `send` in `tests/support/stock/http.ts` calls the API as a member.
- Queues: `tests/support/stock/queue.ts` is a recording `boxQueue` (`delivered`, `sentMessages`) that
  the till server and `portalOwner` pass as `notifications`.
- Arkesel is faked at the network edge by `tooling/arkesel/server.ts` (api-key check, recorded
  requests, `failNext(n)`), started by `tests/support/stock/sms.ts` and the Workers vitest config.
- Queue conformance (`packages/conformance/src/cases/queue.ts`) runs on the box in
  `tests/integration/ports/queue.test.ts` and on Workers in `tooling/worker/tests/queue.test.ts`.
- `runGolden` takes an optional `at` so one golden sale can be dated (the ledger test sells at 14:30).
- Portal e2e use `ownProducts()` (`tests/support/admin/stock.ts`) so specs never shift the seed's stock.

### Customers, credit and loyalty (Day 17)

- Customers: `addCustomer`, `addCreditEntry`, `addLoyaltyEntry`, `addHold`, `folds` and `holdStatuses` in
  `tests/support/customers/seed.ts` write ledgers directly; `customerApi`, `loyaltyApi` and `statementApi` call the
  API as a member of a portal owner. `creditHolds`, `verifiedCustomer`, `secondDevice` and `creditSaleEvent`
  (`credit.ts`) build holds and v5 sales; `startCounter`, `uploader`, `created` and `updated` (`till.ts`) drive the
  till-side customer upload; `setOrg`, `pointsAt`, `saleAt` and a recording `queue()` (`due.ts`) date the account
  workflow; `setOrgSettings` and `shoot` serve the portal e2e specs.
- KYC: `tests/support/kyc/world.ts` signs in as each role, reads the OTP from the Arkesel fake (`otpFor`), and
  scans every store for ID and OTP secrets (`storedText`). It runs the workflow on its own pool.
- Fakes at the network edge: Arkesel is `tooling/arkesel/server.ts`; Maileroo is
  `tests/support/workflows/maileroo.ts` (strict email schema, recorded requests, a held response). Both start in
  the Playwright config and the portal server fixtures.
- A deliberate break per slice is part of the loop; see `docs/plans/day17/verification.md`.
- Portal e2e specs for the Customers area, KYC and settings share one browser worker: run the portal project under
  `flock` when several sessions use the box.

## Commands

```sh
vp test --run                                   # everything (needs `vp run services:up`)
vp test --run tests/integration/tax             # one area
vp -C tooling/worker/tests exec vitest run      # Workers runtime suite on its own
vp run guard                                    # repository rules
```

Direct-upload tests require the local RustFS service and `vp run storage:setup` before integration/e2e suites. Grant issuance, integrity, permission revocation and import idempotency use real PostgreSQL and object storage. Conformance drives direct PUT through both adapter implementations, checks signature tampering/expiry and bounded reads, and preserves old generated R2 keys. Local workerd plus RustFS is not evidence of a live external R2 upload; record live provider verification separately.

### Fiscalisation (Day 19)

- The GRA SDC is faked at the network edge by `tooling/sdc/server.ts` (`down`, `up`, `failNext(n)`,
  `reject(number)`, recorded `arrivals`; `/test/*` routes steer it from a Worker). The Workers vitest config starts
  one and binds `SHOPPER_SDC_URL`/`SHOPPER_SDC_KEY`.
- `tests/support/fiscal/lane.ts` is the lane the shared test API is built with: it records every enqueue, and
  `useLane(boxLane(...))` makes it submit for real. `tests/support/fiscal/docs.ts` seeds pending documents, each with
  its own copy of the provisioned pending sale.
- Lane conformance (`packages/conformance/src/cases/lane.ts`) runs on the box in `tests/integration/ports/lane.test.ts`
  and on Workers in `tooling/worker/tests/lane.test.ts`; `drain(store, rounds)` fires backoff timers at once.
- Archive tests run the workflow with its sleep already over and date acceptances directly: the test plays the clock.
