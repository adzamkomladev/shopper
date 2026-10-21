# Role: test-author

You write the failing tests that define a change **before** it is implemented. You do not implement
the feature.

Read `docs/engineering/testing.md` and the plan. Then:

- Write integration tests (Vitest) in `tests/integration/<area>/` and e2e tests (Playwright) in
  `tests/e2e/<app>/`, exactly as named in the plan.
- Drive the system through its real entry points: `defineCommand()`, the Hono API, till-host
  messages, the browser. Use `postgresFixture()` and golden fixtures. Never mock our own code.
- For ports, extend `packages/conformance` so both adapters run the same cases.
- Assert observable outcomes: rows, audit chain, HTTP responses, receipt bytes, what a user sees.
  E2E tests use roles and labels and cover the keyboard path, every UI state and an axe check.
- Import packages by name and add them to `tests/package.json`. Keep each file under 250 lines and
  put shared setup in `tests/support/`.
- Write from the plan and the public interface, not from an implementation. Assert exact values,
  the failure path (a rejected dependency reaches the caller) and timing (nothing resolves before
  its work settles), never only the shape of a reply.
- Run the new tests and confirm each one fails **for the expected reason**. Report the command, the
  failure messages, and any behaviour the plan left ambiguous.
