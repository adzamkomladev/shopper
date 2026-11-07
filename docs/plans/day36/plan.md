# Day 36 plan · Box adapters (Rivet)

Branch `day36-rivet` off `day35-catchup` (ebd314f, merged as PR #52). Data is disposable: local Postgres, the Rivet engine
volume (`rivet3-data`), RustFS buckets and `.shopper/` caches may be wiped whenever that is simpler.

## Context

Notion row **36 · Box adapters (Rivet)** (Phase 6, P0, surface Box). Goal: the same API on Bun on the shop's own server,
with Rivet where Cloudflare is used. Done when the box serves the API **and the portal** locally.

What already exists (Days 3–35), so it is not rebuilt:

| Notion task                                         | State today                                                                                           |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `apps/box`: Hono on Bun, same shared API            | Done (`createBoxApp`, `serveRuntime`). **No portal served.**                                          |
| node-postgres → PostgreSQL 18                       | Done (`boxDatabase`, `boxPool`).                                                                      |
| Cache: Drizzle SQLite schema (same as D1)           | Done (`boxCache`, `@shopper/db-sqlite`, bun:sqlite / node:sqlite).                                    |
| Blobs: fs + RustFS (S3) through unstorage/aws4fetch | Done for fs and RustFS imports/receipts. Generic Blobs cases run on fs and R2, **not on RustFS**.     |
| Renderer: Satori → resvg-wasm → pdf-lib             | Done (`boxRenderer`, `renderer.test.ts`).                                                             |
| Every Workflow on Rivet Workflows                   | **Not done.** 17 box launchers run the shared `run*` functions on `memoryWorkflow` (lost on restart). |
| Queue on Rivet                                      | **Not done.** `boxQueue` is in memory: a restart loses pending notifications.                         |
| One Rivet timer as the watchdog                     | **Not done.** `boxWatchdog` is a self-re-arming `setTimeout`.                                         |
| DO twins: Lane, StockHold, RateLimiter, StoreHub    | In process. Lane and StockHold are rebuilt from PostgreSQL at boot (`relaunch`, `rearm`).             |
| Conformance against adapters-box in CI              | Box development adapters pass; **nothing runs against a Rivet engine** and CI has no engine service.  |

Rivet facts verified by spikes against the pinned `rivetkit@3.0.0-preview.3` + `rivetdev/engine:3.0.0-preview.3`
(platforms.md pins both):

- `actor({ run: workflow(async (ctx) => …) })` from `rivetkit/workflow`; `registry.start()` connects a runner to the
  engine (`endpoint`, `token`, `namespace`); `node.poolName` + client `poolName` isolate one process's actors.
- Non-step code **replays**; entries are keyed by name (a duplicate name in one run is a divergence error).
- Suspension is an exception (`SleepError`, `MessageWaitError`, `EvictedError`, …). `queue.next` with a timeout throws;
  `queue.nextBatch({ count: 1, timeout })` returns `[]` on timeout.
- A workflow sleeping in a host that is **SIGKILLed** finishes in a fresh host after the engine's lost-runner timeout
  (~45 s). Messages sent before the wait are buffered.

## Decisions

1. **One generic `flow` actor, keyed by the instance id.** A `start(kind, params)` action stores the launch once and
   enqueues it; the run looks the kind up in a process-local handler table and runs the **shared `run*` function**
   through a `Workflow` port adapter. No business code changes, no route written twice. Loop kinds (account,
   statements, KYC, KYB, onboarding…) run inside `ctx.loop`, so "start while running" becomes a wake and an ended loop
   starts again cleanly, as `boxLoopFlows` does today.
2. **The adapter hides Rivet's control flow from shared code.** Two shared workflows catch every error (`price.ts`
   records a failure, `momo.ts` runs an "interrupted" step). A Rivet suspension must never reach them: the adapter
   catches engine control errors, leaves the shopper promise pending and rejects the outer run so the engine suspends.
3. **Steps keep the port's retry semantics.** Rivet steps run with `maxRetries: 0`; the adapter retries inside the step
   with `retryDelay(policy)` (the same function the memory engine uses) and stores a terminal failure as step _data_,
   rethrown deterministically on replay. Rivet never retries or fails a step on its own.
4. **Engine choice is injected, not duplicated.** Each box launcher factory takes an optional `launch` (default
   `memoryLaunch`, the current in-process behaviour). `createBoxApp` passes `rivetLaunch` when `RIVET_ENDPOINT` is set.
   Business tests keep using the memory engine; the **Rivet engine is proven by conformance against a real engine**.
   This also deletes the start/send/started-set boilerplate repeated in 17 launcher files.
5. **Queue and watchdog move to Rivet** — they are the two restart losses that PostgreSQL does not cover today.
   The `notices` actor keeps messages in its durable queue and retries with `NOTIFICATION_RETRY`; the `watchdog` actor
   arms `c.cron.set("59 23 * * *", UTC)`.
6. **Lane, StockHold, RateLimiter, StoreHub stay in process today.** Lane and StockHold are rebuilt from PostgreSQL
   at boot already, so an actor adds no durability; RateLimiter and StoreHub sit on every request / socket of a single
   box process, where an engine round-trip is pure latency. Recorded in platforms.md; revisit if the box ever runs more
   than one process. (Pushback on the Notion list — reported in remarks.)
7. **The box serves the portal.** `SHOPPER_PORTAL_DIR` (default `apps/portal/dist/client` relative to the build) is
   served by Hono's `serveStatic` for every non-`/api` GET, with SPA fallback to `index.html`; `/api/*` stays the API.
   Path traversal is refused by `serveStatic`. The host-only `/_serverFn/*` meta query is cloud-only and renders nothing
   on the box.
8. **CI runs a Rivet engine.** `rivetdev/engine:3.0.0-preview.3` joins the integration services with the dev compose
   settings; `RIVET_ENDPOINT/TOKEN/NAMESPACE` default to the local compose values in tests.

Out of scope today (named, not silently dropped): rclone mirror to R2 and the installer's `SHOPPER_BLOBS` prompt
(Day 39 installer), compiling the napi runner into the sealed Bun binary (Day 38), engine-side tuning of the 45 s
lost-runner timeout.

## How I work (per your instructions)

No subagents. Per slice: failing integration test first (`tdd-slice` skill), break-check it, implement, run the slice's
tests, `vp check`, `vp run guard`, commit. Before push: `codex review` (gpt-6.1-sol) directly (`pre-merge-review`
checklist), fix findings with tests. Push once, open the PR, bind it with ccd_pr, watch CI, fix and re-push until green,
squash-merge. Then update the Notion Day 36 page (tasks ticked, Progress, Remarks) and write
`docs/plans/day36/verification.md`. The only UI change is serving the existing portal from the box: it is verified with
`playwright-cli` against the box (login screen at 1920/1440/768/390/till size, console, overflow); no screen changes, so
the Figma frames are only compared for regressions.

## S0 · Dependencies and services

- `rivetkit@3.0.0-preview.3` in `@shopper/adapters-box` (exact pin; guard already allows `rivetkit` in adapters).
  `cbor-extract: false` in `allowBuilds` (cbor-x falls back to JS).
- CI: `rivet` service in `.github/workflows/ci.yml` integration/e2e services.
- `tests/support/rivet.ts`: engine settings from env with the compose defaults; a unique pool per test process.

## S1 · Rivet workflow engine (`packages/adapters/box/src/rivet/`)

Tests first — `tests/integration/ports/rivet.test.ts`, against the real engine, each test its own instance ids:

1. Early events: `send` before the wait, then `waitFor` receives it (port contract).
2. `waitFor` timeout surfaces `WorkflowTimeoutError` to shared code, which can catch it and continue.
3. Named-step retry: a step that fails once succeeds on attempt 2; the same name again returns the stored output and
   does not run the body.
4. A terminal step failure is catchable by shared code, and a catch-all around a sleep never sees a suspension
   (the `price.ts` shape: the failure branch must not run).
5. Duplicate `start` is a no-op (body runs once); `send` to an id that is not started yet is delivered once it starts.
6. Loop kind: `start` while running wakes it; `start` after it ended runs it again.
7. `sleepUntil` and `compensate` (compensations run newest first, once).
8. **Restart**: a host child process starts a flow that sleeps; the test SIGKILLs it, starts a second host, and the flow
   finishes there (its "after" step writes a PostgreSQL row). Bounded at 90 s.

Implementation: `rivet/host.ts` (registry, `flow` actor, client, handler table, pool), `rivet/flow.ts` (port adapter),
`workflows/launch.ts` (`memoryLaunch`, `rivetLaunch`).

## S2 · Box launchers on the injected engine

- Every `box*` workflow factory takes `launch` and drops its own start/send/started-set code; `boxLoopFlows` becomes
  `launch(kind, schema, run, { loop: true })`.
- Existing launcher tests (`launcher.test.ts`, workflows/*, kyb, statements, store days, anchors…) stay green on the
  memory engine; `workflowLauncherConformance` additionally runs the **auth launchers on Rivet**.
- `createBoxApp`: when `RIVET_ENDPOINT` is set, start the host and pass `rivetLaunch`.

## S3 · Durable notification queue and watchdog

- `queueConformance` against `rivetQueue` (delivery, retry with backoff, dead letter at `maxAttempts`, ack once).
- Watchdog test: the `watchdog` actor registers its cron as `59 23 * * *` UTC and its action runs `runWatchdog`
  (fired directly through the actor action in the test; the cron itself is Rivet's).
- `createBoxApp` uses both when Rivet is configured.

## S4 · Blobs conformance on RustFS

- `blobsConformance` exported from `@shopper/conformance`; run against `boxBlobs` with RustFS receipts storage
  (with a clock) in `uploads.test.ts`. fs and R2 already run it.

## S5 · The box serves the portal

Tests first — `tests/integration/box/portal.test.ts`: `GET /` and `GET /stores/abc` return the shell's `index.html`;
`GET /assets/<file>` returns the asset with its content type; `GET /../package.json` and encoded traversal do not leak;
`GET /api/health` still answers the API. Then `playwright-cli` opens the box URL and signs in screen renders.

## S6 · Docs, review, ship

platforms.md (Rivet engine section, the in-process twins decision, env vars), `apps/box/README.md`,
`packages/adapters/box/README.md`, conformance README; `docs/plans/day36/verification.md`. Codex review, PR, CI, merge,
Notion.
