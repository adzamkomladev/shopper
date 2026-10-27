# Cloudflare and Rivet: one implementation, two platforms

Use what each platform does natively instead of building it ourselves. Keep the business logic
identical on both. The cloud version uses Cloudflare to the full, and the on-prem box uses Rivet to the
full. Both call the **same shared functions**, so behaviour cannot drift.

## The pattern

1. Write the behaviour once as a plain function in a domain package (`core`, `api`, `sync`). It takes
   its dependencies as ports or Drizzle and its input as a Valibot-validated value.
2. Each adapter is a thin shell that receives the platform event (DO method, actor action, workflow
   run, queue batch), builds the dependencies, and calls the function. A shell over ~20 lines is
   doing business logic in the wrong place.
3. `packages/conformance` proves both shells behave the same.

```ts
// Sketch of packages/core/src/store-day.ts: written once, run by Cloudflare Workflows AND Rivet Workflows
export async function runStoreDay(workflow: Workflow, deps: StoreDayDeps, input: StoreDayInput) {
  await workflow.sleepUntil("open", input.opensAt);
  const shift = await workflow.step("open-day", retry.standard, () => openDay(deps, input));
  await workflow.sleepUntil("close", input.closesAt);
  await workflow.waitFor("z-report", "z-report.approved", HOURS_12);
  return workflow.step("close-day", retry.standard, () => closeDay(deps, shift));
}
```

The `Workflow` port (`packages/ports/src/workflow.ts`) defines `step`, `sleep`, `sleepUntil`,
`waitFor`, `send` and `compensate`. `adapters/cf` binds it to a `WorkflowEntrypoint`
(`step.do`, `step.sleep`, `step.sleepUntil`, `step.waitForEvent`). `adapters/box` binds it to a
Rivet workflow. The live example of this pattern is `nextStoreSequence()`, which is shared by the
`StoreSequencer` Durable Object and `boxSequencer()`. The first real workflow is `runPriceChange()`
(`packages/core/src/workflows/price.ts`): `PriceChangeWorkflow` runs it on Cloudflare and
`boxPriceChange()` on the box (memory engine until Rivet, day 36).

- Start workflows through a `WorkflowLauncher` (one per kind). `start` only acknowledges the launch;
  starting an existing instance id is a no-op on both engines. Ids must pass
  `workflowInstanceIdSchema` (Cloudflare's rule: letters, digits, `-`, `_`, at most 100 characters).
- Launch inside the command that creates the business row. If that transaction rolls back, the flow
  finds nothing and closes its `workflow_run` instead of sleeping. Money-moving MoMo is the narrow
  exception: commit the audited payment intent before acknowledging its launch, so an immediate
  provider charge can only run against a committed intent. The till reserves its UUID reference
  before HTTP; a failed launch returns 503 and a retry of that same reference resumes launch,
  without creating another intent or charge. Unresolved intents remain readable for recovery.
- Step outputs are JSON and checkpointed through `defineCommand`, so a retried step resends the same
  envelopes. A flow that runs out of retries records `failed` before it throws.
- The `Realtime` port: device ids are UUIDv7, cursors are store sequences (`sequenceSchema`), one
  socket per device, replay in sequence order from a bounded log, and deliveries run one at a time.
  A failing handler drops that subscription; the subscriber reconnects from its cursor.

## Feature map

| Concern                        | Cloud: Cloudflare                                                               | On-prem: Rivet / Bun                                             | Shared code                                     |
| ------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------- |
| HTTP API                       | Workers + Hono (`apps/edge`)                                                    | Hono on Bun’s native server (`apps/box`)                         | `@shopper/api`                                  |
| Portal (Start SPA mode)        | Static shell on Workers Static Assets; one Worker for `/api/*` + `/_serverFn/*` | Embedded in the box binary                                       | `@shopper/backoffice`                           |
| Customer shop (SSR)            | TanStack Start on Workers, **service binding** to the API Worker                | (v1.5 online orders)                                             | `apps/shop`                                     |
| System of record               | Neon PostgreSQL via **Hyperdrive**                                              | PostgreSQL 18                                                    | Drizzle + `@shopper/db-pg`                      |
| Cache, short-term store        | **D1**                                                                          | SQLite inside Rivet actors                                       | `@shopper/db-sqlite` + Cache port               |
| Rarely-changing config         | **KV**                                                                          | Box config file / PG                                             | `@shopper/config`                               |
| Blobs (images, archives, PDFs) | **R2** (unstorage)                                                              | RustFS (S3) or fs (unstorage), mirrored to R2 nightly            | Blobs port                                      |
| Hot coordination (5 classes)   | **Durable Objects**, SQLite storage + alarms                                    | **Rivet actors**: state, SQLite, `schedule`, actions             | Sequencer / Lane / StockHold ports              |
| Till realtime (StoreHub)       | DO **WebSocket hibernation**                                                    | Actor **connections + events/broadcast**                         | Realtime port                                   |
| Business processes             | **Workflows** (`sleep`, `sleepUntil`, `waitForEvent`, retries)                  | **Rivet Workflows** (steps, timers, queues, rollback)            | Workflow port                                   |
| Fire-and-forget fan-out        | **Queues** + dead-letter queue                                                  | Rivet actor **queues**                                           | Queue port                                      |
| The one watchdog               | One **Cron Trigger**                                                            | One Rivet **cron job / schedule**                                | Scheduler port                                  |
| Till storage and secrets       | Electron `safeStorage` (DPAPI) seals the SQLCipher key and device token         | same (the till is identical)                                     | SQLite3 Multiple Ciphers, `register.secret`     |
| Receipt PNG/PDF                | **Browser Run** `quickAction` (cloud) · Electron `printToPDF` (till)            | Satori → resvg-wasm → pdf-lib in the binary                      | Renderer port + receipt JSON                    |
| Abuse protection               | **Turnstile** on public shop forms; **Rate Limiting** binding per IP            | RateLimiter actor (LAN only)                                     | RateLimiter port for tenant limits              |
| Secrets                        | `cf workers secrets` / **Secrets Store**                                        | Sealed box config, never in the repo                             | `@shopper/config` reads both                    |
| Logs and traces                | **Workers Logs + Traces** (enabled in `cloudflare.config.ts`) , structured JSON | Rivet **inspector** + **OpenTelemetry** for actors and workflows | One log shape: `{ event, orgId, storeId, ... }` |
| Usage metrics                  | **Workers Analytics Engine** (requests, sales count per tenant)                 | Local counters in PG                                             | Never used for reports                          |
| Releases                       | **Versions + gradual deployments**, staging env                                 | Signed binary + migration on start                               | [deployment.md](deployment.md)                  |

### The portal Worker

Portal = TanStack Start in SPA mode: a prerendered static shell served by Workers Static Assets; one Worker runs only for `/api/*` (the shared Hono API through native Hyperdrive, D1, R2, Durable Object and Workflow bindings) and `/_serverFn/*` (host-only server functions). Backoffice data stays on the shared API so the box SPA and Electron reuse it.

- `cloudflare.config.ts` sets `assets.notFoundHandling: "single-page-application"` and
  `runWorkerFirst: ["/api/*", "/_serverFn/*"]`, so documents and static files never start the
  Worker. Every other binding (Hyperdrive, D1, R2, queue, Durable Objects, Workflows) sits on the
  same Worker.
- Durable Object classes are declared in `cloudflare.config.ts` `exports` (`exports.durableObject({ storage: "sqlite" })`), never `migrations`: the deployed Workers use the declarative exports flow
  and Cloudflare rejects a switch back to migrations (code 100403).
- `worker.ts` stays thin: `cloudflarePortalContext(env)` from `@shopper/adapters-cf/portal` returns
  the request context (`portalRuntime`, `portalHost`, `portalHealth`). Bindings never leave the
  adapter, so `apps/portal` imports no `cloudflare:*` module.
- Server functions (`apps/portal/src/functions/`) are host-only: build info and a binding health
  check. Business data always goes through `/api`.
- `vite build` prerenders the shell by previewing the built Worker (`spa.prerender.outputPath:
  "/index"` emits `dist/client/index.html`). Workerd does not inherit the build process's
  environment, so a small plugin in `vite.config.ts` writes a preview-only `dist/server/.dev.vars`
  that tells Start it is prerendering; deployment tooling never ships that file, and the preview
  does not open the remote `IMPORTS` bucket.

Before using a Cloudflare product that is not in this table, load the `cloudflare` and
`workers-best-practices` skills (Claude) or check the Cloudflare docs MCP. For Rivet, check
`https://rivet.dev/llms.txt` or the context7 MCP. Never rely on memory for platform APIs.

## Rules that keep both sides honest

- **PostgreSQL is the record.** Every workflow step and every DO/actor write also writes its table
  and an audit row in one transaction, and updates `workflow_run`. Reports never read engine state.
- **No platform IDs in business tables.** No DO ids, no actor keys. Workflow instance id = the
  business key (for example `store-day_<orgId>_<storeId>_<date>`; Cloudflare instance ids allow only letters, digits, `-` and `_`), so both engines address the same
  thing.
- **Exactly five coordination classes**: StoreSequencer, StoreHub, FiscalLane, StockHold, RateLimiter.
  Ask before adding a sixth. Each exists as a DO and as a Rivet actor. FiscalLane is built (Day 19): the DO keeps
  each store's queue in its SQLite and drains it with alarms; the box twin is the in-process `boxLane` until the
  Rivet actor lands on Day 36. Both pass `laneConformance`.
- **Never poll and never put business logic on a cron tick.** A wait on people, partners or time is a
  workflow `sleepUntil` or `waitFor`.
- **The one watchdog** fires at 23:59 UTC (Accra keeps UTC all year): the edge `scheduled` handler
  (`59 23 * * *`, the only cron trigger) on Cloudflare, a self-re-arming Bun timer on the box until the Rivet
  schedule lands on Day 36. It only starts workflows: `audit-anchor` per org per day, and `store-day` per store
  for today and tomorrow (`runWatchdog`, `packages/core/src/workflows/watchdog.ts`), so a chain that died is
  restarted within a day. Starting an instance id that exists is a no-op, so a second firing is harmless. The
  work happens in the workflow.
- **The store day** (`runStoreDay`, `packages/core/src/workflows/day.ts`; `StoreDayWorkflow` on the `STORE_DAY`
  binding, `boxStoreDays` on the box) is one instance per store and shop date: `open` reads the store's hours
  (an edit applies from the next day), `sleepUntil` opening, `opened`, `sleepUntil` closing, then the Z-report
  reminder (only when a register sold after its last Z) and the owner summary go out by email, `sleepUntil`
  00:05 the next day, the nightly rollup, `close`, and the next day's instance. Every step is a
  `defineCommand` checkpoint, so a rerun replays its output and sends nothing twice. A new store starts its
  day when it is created; the box relaunches unfinished days on boot, since its memory engine forgets sleeps.
- **Rollups are a cache with a dirty bit.** `rollStoreDays` folds each store day into `report_sales`,
  `report_tender` and `report_product` and sets `store_day.rolled_at`; accepting a sale or refund for a day
  clears it. Reports read the rollup rows of rolled days `UNION ALL` the same fold over raw rows for the rest,
  in one repeatable-read snapshot, so they are always exact and fast where rolled.
- **Cache port: never read after write in the same request.** It is not a source of truth.
- **Cloud-only extras degrade gracefully.** If a Cloudflare feature has no box twin (Analytics Engine,
  Images resizing), the shared code must not depend on it. Put it behind an optional port, and have
  the box return the plain result.
- **Workers runtime rules:** stream unbounded bodies, tie async work to `ctx.waitUntil`, no module-level
  request state, generated `Env` types (`cf workers types`), `this.env` inside DO classes, compatibility
  date kept current with tests run on change.
- **Queues are push on Cloudflare and in-process on the box.** The port is `send` only; consumers are
  a `QueueHandler`. `cloudflareDeliver` settles every message exactly once and retries any the
  handler neither acked nor retried, so nothing is acked silently; the edge Worker's `queue()` export
  is the only consumer (DLQ `shopper-notifications-dlq-<stage>`). `boxQueue` retries on unref'd
  timers and logs `queue.dead_letter` after `maxAttempts`; its messages are lost on a box restart
  until the Rivet queue (Day 36). Both follow `NOTIFICATION_RETRY` (`@shopper/ports`); the edge
  trigger's `maxRetries` is `maxAttempts − 1`, pinned by `edge.test.ts`.
- **Serialization differs per transport** (Queues, Workflow step outputs, DO storage, WebSockets).
  Step outputs must be `Json` (the port enforces this). Check limits per API before sending large data.

## Registration and invitation workflows

`AuthWorkflow` is the cloud shell behind `AUTH_FLOWS`; `boxAuthFlows` is the on-prem
launcher. Both run `runAuthFlow` from `@shopper/auth`, using business UUIDs as instance IDs.
The launcher port delivers typed events as well as starting instances. `auth-action` carries
only `retry` or `completed`; passwords and secret links never enter workflow parameters,
step outputs or audit records.

Public registration uses the dedicated registration tables until completion. Its verification
link expires after 24 hours and invitation links after seven days. Links are reconstructed with
purpose-separated HMACs using `SHOPPER_LINK_SECRET`; only their digests are stored.
Registration's separate resend capability cannot verify email. Maileroo delivery uses the same
fetch client on both platforms; PostgreSQL checkpoints retain success/failure for management.
An explicit requester retry or invitation reissue recovers a delivery failure without polling.

The box currently uses memory workflow timers. Deadlines and consumed/replaced/cancelled state
remain in PostgreSQL and are checked on every request after restart; recovering waiting engine
instances automatically remains scheduled for day 36. LAN invitation setup works without WAN
and does not mark the new account's email verified.

### Till realtime transport (Day 9)

`/sync/live` authenticates the Bearer token and device header before upgrading. The cloud forwards
the trusted device scope to the hibernating StoreHub; the box shares one in-process realtime hub
with its Bun WebSocket and price workflow. The Rivet StoreHub actor replaces this hub on day 36.
This avoids adding RivetKit and its engine/compiled-binary verification on sync gate day.

Store feed commands send `store.changed` nudges after commit. Nudges contain only sequences;
PostgreSQL pull remains authoritative. Transport fallback is the exception to the no-poll rule:
a disconnected till pulls and reconnects after 30 seconds, with backoff capped at five minutes.
A healthy idle socket also pulls every five minutes to repair lost nudges. These timers repair
transport delivery; business processes still use Workflows.

Direct browser asset uploads are managed by `@shopper/assets` and use presigned PUT to R2/RustFS. Imports, till receipt PDFs (`receipts/` keys, own bucket) and generated snapshots have separate policies; no upload bytes pass through Hono. Blobs supports bounded reads for integrity validation immediately before processing. Server-generated objects retain the existing R2/filesystem paths; an unavailable S3 upload store fails rather than proxying bytes. See [assets.md](assets.md).

## KYC workflow

`KycWorkflow` is the cloud shell behind `KYC_FLOWS` (`shopper-kyc-<stage>`); `boxKycFlows` is the on-prem
launcher on `memoryWorkflow`. Both run `runKyc` from `@shopper/auth/kyc`, one instance per case (instance
id = case id, `workflow_run.type` = `kyc`). `cloudflareFlow` (`adapters/cf/src/workflows/flow.ts`) is the one
adapter from a Cloudflare `step` to the `Workflow` port; the momo, auth and KYC shells all use it.

Events carry only `{action}` and only wake the flow: it reads the `kyc_case` row, so a lost event or timer is
caught up at the next deadline, and a late answer is refused from the row's deadlines (OTP 10 minutes, at most 3
sends, 5 attempts, a 7-day decision window). The OTP is derived from the link secret and the send number, so a
retried SMS repeats the same code; only an HMAC digest is stored. An ID number is reduced to a mask and an HMAC
fingerprint before any command runs. Neither the number nor a code reaches an event, step output, audit row or log.
The edge needs `KYC_FLOWS`, `ARKESEL_API_KEY`, `ARKESEL_SENDER` and `SHOPPER_LINK_SECRET`; without them the KYC
case routes answer 503. Box timers are lost on restart (Rivet, day 36); PostgreSQL deadlines decide until then.

## Account and statement workflows (Day 17)

Three workflows now share `cloudflareFlow`, the one adapter from a Cloudflare `step` to the `Workflow` port (momo,
auth, KYC, account and statements all use it; a shell is about 20 lines):

| Workflow                     | Instance id | Binding (`<stage>`)          | Runs                                  |
| ---------------------------- | ----------- | ---------------------------- | ------------------------------------- |
| KYC (`runKyc`)               | case id     | `shopper-kyc-<stage>`        | OTP, ID step, decision, expiry        |
| Account (`runAccount`)       | customer id | `shopper-account-<stage>`    | interest, points expiry, tier notices |
| Statements (`runStatements`) | org id      | `shopper-statements-<stage>` | the monthly run and its fan-out       |

Each writes its own table and a `workflow_run` row in the same transaction as the step. Events carry only
`{action}` and wake the flow; it re-reads PostgreSQL, so a lost event or timer is caught up at the next deadline.
The account flow sleeps to `nextDue`, the statements flow to the org's run day using an interruptible
`waitFor("wake", timeout)`, which a settings change wakes. Statement delivery and tier notices run on the existing
notifications queue consumer (`apps/edge`); no new Durable Object, queue or port.

On the box the three run on `memoryWorkflow`. Its timers die with the process, so the box **relaunches on boot**
every account with anything due, every org with a monthly schedule (starting from the last period sent, so a missed
run day runs once) and every open KYC case. `ponytail:` Rivet takes over the timers on Day 36.

The edge needs `KYC_FLOWS`, `ACCOUNT_FLOWS` and `STATEMENT_FLOWS`; without them the routes that start a flow answer 503. The portal Worker serves the public `/statement/*` page from the prerendered shell.

## Notifications queue

Low-stock alerts and statements share one notifications queue. Statements pick SMS or email per delivery; a
low-stock alert is SMS only. On a box or Worker with only mail configured (no `ARKESEL_API_KEY`), a low-stock
message cannot be sent, so it is retried and then dead-lettered by design: nothing falls back to email. Configure
Arkesel wherever low-stock alerts are wanted. Statement PDFs are at most 366 days of entries and break into A4-height
pages; a statement link signs only with a link secret of at least 32 characters.
