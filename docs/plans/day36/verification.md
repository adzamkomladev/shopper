# Day 36 verification

## Engine tests (real Rivet 3.0 engine, `rivetdev/engine:3.0.0-preview.3`)

`tests/integration/ports/rivet.test.ts` (8 tests) runs the shared Workflow port on Rivet Workflows:

- an event sent before the wait, and before the start, is delivered;
- a wait that times out throws `WorkflowTimeoutError` into shared code;
- a step retries by the port's policy and its stored output is not run again;
- a terminal step failure is catchable, and a shared catch-all never sees an engine suspension
  (break-checked: letting the guard rethrow `SleepError` fails this test);
- a duplicate start runs once; a loop kind takes a start while running as one more pass;
- `sleepUntil` and compensations (newest first, once);
- **restart**: a child host is SIGKILLed mid-sleep and the workflow finishes in a second host (about 45 s,
  the engine's lost-runner timeout).

## Queue, watchdog, blobs, portal

- `tests/integration/ports/queue.test.ts`: `queueConformance` and dead-lettering on `launchQueue` with the
  memory engine and with Rivet (15 tests). Break-checked: treating a silent delivery as acked fails 4.
- `tests/integration/audit/anchor.test.ts`: the day-chained watchdog fires at 23:59 UTC two days running.
- `tests/integration/ports/uploads.test.ts`: `blobsConformance` passes on RustFS receipts storage.
- `tests/integration/box/portal.test.ts` (5 tests): shell for browser navigations with the portal's
  headers, assets with their content type, no traversal (`%2e%2e`, `%2f`, `%5c`; break-checked), `/api/*` is
  the API, JSON calls at the root stay the API, no shell without `SHOPPER_PORTAL_DIR`.

## The real box in a browser

The box ran on Bun from source against the dev PostgreSQL, Rivet (`RIVET_ENDPOINT`) and
`SHOPPER_PORTAL_DIR` set to the portal build's static assets. Boot relaunches on Rivet logged no errors.
With `playwright-cli`: `/login` rendered, the seeded owner signed in through `/api/auth/sign-in/email`,
`/products` loaded from `/api/*`, and a hard reload of `/products` served the shell. Screenshots at
1920×1080, 1440×900, 1366×768, 768×1024 and 390×844; no horizontal overflow at any size.

Remaining console output on the box: one 404 for the cloud-only `/_serverFn/*` host metadata (no longer
retried: `retry: false` in `HostMeta`), and `favicon.ico`, which the portal build does not ship.

Figma frames were not compared: the Figma MCP needs authentication in this environment. The screens are
unchanged; only their host changed.
