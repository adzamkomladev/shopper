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
  e2e/<app>/                  Playwright user flows per app: portal/, shop/, till-ui/
tooling/worker-tests/         Workers runtime suite (Vitest 4 + Cloudflare plugin), invoked from
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
  `tooling/worker-tests`). A port change without both green is not done.
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
- a screenshot comparison at till (1366×768), desktop (1440×900) and mobile (390×844) sizes for
  the portal and shop.

E2E tests use roles and labels (`getByRole("button", { name: "Charge" })`), never CSS classes or
test IDs, unless no accessible name exists, and then the missing name is the bug.

## Commands

```sh
vp test --run                                   # everything (needs `vp run services:up`)
vp test --run tests/integration/tax             # one area
vp -C tooling/worker-tests exec vitest run      # Workers runtime suite on its own
vp run guard                                    # repository rules
```
