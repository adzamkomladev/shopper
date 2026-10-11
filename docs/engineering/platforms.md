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

The `Workflow` port (`packages/ports/src/index.ts`) defines `step`, `sleep`, `sleepUntil`,
`waitFor`, `send` and `compensate`. `adapters-cf` binds it to a `WorkflowEntrypoint`
(`step.do`, `step.sleep`, `step.sleepUntil`, `step.waitForEvent`). `adapters-box` binds it to a
Rivet workflow. The live example of this pattern is `nextStoreSequence()`, which is shared by the
`StoreSequencer` Durable Object and `boxSequencer()`.

## Feature map

| Concern                        | Cloud: Cloudflare                                                        | On-prem: Rivet / Bun                                             | Shared code                                     |
| ------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------- |
| HTTP API                       | Workers + Hono (`apps/edge`)                                             | Elysia `app.mount()` of the same Hono app (`apps/box`)           | `@shopper/api`                                  |
| Portal SPA                     | Workers Static Assets                                                    | Embedded in the box binary                                       | `@shopper/backoffice`                           |
| Customer shop (SSR)            | TanStack Start on Workers, **service binding** to the API Worker         | (v1.5 online orders)                                             | `apps/shop`                                     |
| System of record               | Neon PostgreSQL via **Hyperdrive**                                       | PostgreSQL 18                                                    | Drizzle + `@shopper/db-pg`                      |
| Cache, short-term store        | **D1**                                                                   | SQLite inside Rivet actors                                       | `@shopper/db-sqlite` + Cache port               |
| Rarely-changing config         | **KV**                                                                   | Box config file / PG                                             | `@shopper/config`                               |
| Blobs (images, archives, PDFs) | **R2** (unstorage)                                                       | RustFS (S3) or fs (unstorage), mirrored to R2 nightly            | Blobs port                                      |
| Hot coordination (5 classes)   | **Durable Objects**, SQLite storage + alarms                             | **Rivet actors**: state, SQLite, `schedule`, actions             | Sequencer / Lane / StockHold ports              |
| Till realtime (StoreHub)       | DO **WebSocket hibernation**                                             | Actor **connections + events/broadcast**                         | Realtime port                                   |
| Business processes             | **Workflows** (`sleep`, `sleepUntil`, `waitForEvent`, retries)           | **Rivet Workflows** (steps, timers, queues, rollback)            | Workflow port                                   |
| Fire-and-forget fan-out        | **Queues** + dead-letter queue                                           | Rivet actor **queues**                                           | Queue port                                      |
| The one watchdog               | One **Cron Trigger**                                                     | One Rivet **cron job / schedule**                                | Scheduler port                                  |
| Online-order PDFs              | **Browser Run**                                                          | Satori → resvg → pdf-lib in the binary                           | Renderer port + receipt JSON                    |
| Abuse protection               | **Turnstile** on public shop forms; **Rate Limiting** binding per IP     | RateLimiter actor (LAN only)                                     | RateLimiter port for tenant limits              |
| Secrets                        | `wrangler secret` / **Secrets Store**                                    | Sealed box config, never in the repo                             | `@shopper/config` reads both                    |
| Logs and traces                | **Workers Logs + Traces** (enabled in `wrangler.jsonc`), structured JSON | Rivet **inspector** + **OpenTelemetry** for actors and workflows | One log shape: `{ event, orgId, storeId, ... }` |
| Usage metrics                  | **Workers Analytics Engine** (requests, sales count per tenant)          | Local counters in PG                                             | Never used for reports                          |
| Releases                       | **Versions + gradual deployments**, staging env                          | Signed binary + migration on start                               | [deployment.md](deployment.md)                  |

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
  Ask before adding a sixth. Each exists as a DO and as a Rivet actor.
- **Never poll and never put business logic on a cron tick.** A wait on people, partners or time is a
  workflow `sleepUntil` or `waitFor`.
- **Cache port: never read after write in the same request.** It is not a source of truth.
- **Cloud-only extras degrade gracefully.** If a Cloudflare feature has no box twin (Analytics Engine,
  Images resizing), the shared code must not depend on it. Put it behind an optional port, and have
  the box return the plain result.
- **Workers runtime rules:** stream unbounded bodies, tie async work to `ctx.waitUntil`, no module-level
  request state, generated `Env` types (`wrangler types`), `this.env` inside DO classes, compatibility
  date kept current with tests run on change.
- **Serialization differs per transport** (Queues, Workflow step outputs, DO storage, WebSockets).
  Step outputs must be `Json` (the port enforces this). Check limits per API before sending large data.
