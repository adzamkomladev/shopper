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

## Layout

```text
tests/
  package.json                @shopper/tests: declares every package the suites import
  fixtures/                   shared data and environments (postgres.ts, golden sales, receipts)
  support/                    shared helpers: builders, API clients, login, clocks
  integration/<area>/         Vitest, run by `vp test`
    api/  audit/  auth/  core/  db/  edge/  hardware/  ports/  tax/  tooling/
  e2e/<app>/                  Playwright user flows per app: portal/, shop/, till/ui/
tooling/worker/tests/         Workers runtime suite (Vitest 4 + Cloudflare plugin), invoked from
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
  share state between files. Vitest runs files serially (`fileParallelism: false`).
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
and only `/_serverFn/*` to the Start bundle. `tests/integration/tooling/portal.test.ts` builds the
portal and checks the prerendered shell and the Static Assets routing; `tooling/worker/tests/portal.test.ts`
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
the real binary through `tests/support/hardware/electron.ts`, which builds the Electron main and the
till host, then runs `xvfb-run -a electron --no-sandbox --disable-gpu dist/main.js` when `DISPLAY` is
unset. `--disable-gpu` is required under Xvfb: with GPU compositing `capturePage` fails with
`UnknownVizError`. Render-only mode (`SHOPPER_ELECTRON_RENDER_ONLY=1`) answers `render` messages over
the child's Node IPC channel and starts no host.

`equivalence.test.ts` renders the golden receipt with Electron and with `boxRenderer()` and compares
them: both 576 px wide, heights within 8 px, `pixelmatch` (threshold 0.2) differing on at most 2% of
pixels. The constants at the top of the file are calibration knobs. Set `SHOPPER_RENDER_DIFF_DIR` to
write both PNGs and the diff image. Receipt line heights are whole pixels because Satori rounds
fractional ones up, which drifted the two engines apart by 5 px.

## Commands

```sh
vp test --run                                   # everything (needs `vp run services:up`)
vp test --run tests/integration/tax             # one area
vp -C tooling/worker/tests exec vitest run      # Workers runtime suite on its own
vp run guard                                    # repository rules
```

Direct-upload tests require the local RustFS service and `vp run storage:setup` before integration/e2e suites. Grant issuance, integrity, permission revocation and import idempotency use real PostgreSQL and object storage. Conformance drives direct PUT through both adapter implementations, checks signature tampering/expiry and bounded reads, and preserves old generated R2 keys. Local workerd plus RustFS is not evidence of a live external R2 upload; record live provider verification separately.
