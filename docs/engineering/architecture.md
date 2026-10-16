# Architecture and import boundaries

Read this before adding a file, a package, or a dependency between two projects.
`vp run guard` enforces every rule marked **(guard)**. CI fails on any violation.

## The three kinds of project

| Folder       | What lives there                                                                                   | May import                                            |
| ------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `apps/*`     | Deployable things: a Worker, the box binary, an SPA, the till shells. Composition and wiring only. | `packages/*` only                                     |
| `packages/*` | All business logic, contracts, schemas, UI components, adapters. Each package has one job.         | Other `packages/*`, in one direction only (no cycles) |
| `tooling/*`  | Developer experience: scripts, the guard, seeds, dev services, test runners. Never shipped.        | Anything                                              |
| `tests/`     | Integration and e2e suites (`@shopper/tests`). See [testing.md](testing.md).                       | `packages/*`, `apps/*` entry points, `tooling/*`      |

Rules:

- **An app never imports another app (guard).** If two apps need the same code, move it into a
  package. Apps that cooperate at runtime, such as `till-electron` starting `till-host`, talk over a
  Valibot-checked message contract (IPC, WebSocket or HTTP), never by importing each other.
- **A package never imports an app (guard).** Packages do not know who deploys them.
- **Nothing shipped imports tooling (guard).** The one exception is build configuration
  (`*.config.ts`), which may read `tooling/build/info.ts` and use build plugins.
- **Package dependencies are acyclic (guard).** If two packages need each other, the shared part is
  a third, lower package.
- **Import packages by name (guard).** Write `@shopper/auth/devices`, never `../../packages/auth/src/devices`.
  A relative import may not leave its own project. Expose what others need through `exports` in
  `package.json`.
- **Declare what you import (guard).** Every `@shopper/*` import must be listed in that project's
  `package.json`.

## Package layers

Import downwards only. A package may import its own layer (without a cycle) or any lower layer,
never a higher one. The current dependency graph follows this table; keep it that way.

```text
5  adapters/cf, adapters/box               platform code (the only place for Cloudflare and Rivet)
4  api, backoffice, sync, export           use cases exposed over HTTP, UI or files
3  core, auth, audit, assets, hardware             commands, policies, domain rules
2  ports, db/pg, db/sqlite, conformance    contracts and schemas
1  money, tax, config, ui, utils                  leaves: pure logic, constants, components
```

`ui` is a leaf: it holds presentational components and design tokens. Data fetching and screen
logic live in `backoffice` or the app. When you need a new edge that goes up a layer, stop: either
the code belongs in the lower package, or you are about to create a cycle. Ask before changing a
layer.

## One codebase, two platforms

Business code is written once and runs on Cloudflare (cloud) and on Rivet/Bun (on-prem).

- **Platform imports (guard).** `cloudflare:*`, `@cloudflare/*`, `rivetkit` and `@rivetkit/*` appear
  only in `packages/adapters/*`, `apps/edge`, `apps/box`, build config, tests and tooling.
- **Shared function, thin shell.** Every Durable Object method, Rivet actor action, Workflow step and
  queue consumer is a few lines that call one shared function in `core`/`api`/`sync`. The reference
  example is `nextStoreSequence()` in `@shopper/core`, which is called by both the `StoreSequencer`
  Durable Object (`packages/adapters/cf/src/coordination.ts`) and `boxSequencer()`
  (`packages/adapters/box/src/sequencer.ts`).
- **Ports only where no library abstracts it.** Hono, Drizzle, unstorage and Better Auth already run on
  both. `@shopper/ports` covers the rest: Sequencer, Lane, Workflow, Queue, Realtime, Scheduler,
  Cache, Blobs, Renderer.
- **A port change updates `packages/conformance` and passes against both adapters.**

## Back office and the public routes

Portal = TanStack Start in SPA mode: a prerendered static shell served by Workers Static Assets; one Worker runs only for `/api/*` (the shared Hono API through native Hyperdrive, D1, R2, Durable Object and Workflow bindings) and `/_serverFn/*` (host-only server functions). Backoffice data stays on the shared API so the box SPA and Electron reuse it.

- `@shopper/backoffice` exports `createBackofficeRoutes(rootRoute)`. The host owns the router, root
  route and query client and mounts these routes: the portal today, Electron on day 13. The package
  never creates a router or reads a host global.
- From `@shopper/core`, backoffice may import only `@shopper/core/schemas` (Valibot schemas and
  inferred types, no server code).
- `GET /orgs/:slug` (shop code lookup, returns `{ id, name }`) and `GET /orgs/current` (the box's
  fixed org) are public and read-only. `@shopper/api` dispatches `/orgs/*` before the origin and
  tenant checks, so they need no session or tenant header. Keep them GET-only and minimal.

## Pre-shop registration exception

Every customer table carries an `org_id` foreign key to `org`. Registration is the one exception: before
email verification no customer org exists, so `registration_request`, `registration_audit_log` and
`registration_workflow_run`/`_step` store the server-reserved candidate UUIDv7 (`id` = `org_id`), and the
three child tables reference the request instead of `org`. The request holds the proposed owner
name and email; it creates no customer organisation, user or credentials and does not reserve the
shop code. Completion creates the org with that same id in one outer
transaction. Customer tenancy is unchanged.

A command opts into this storage with `defineCommand({ scope: "registration" })`. The scope is part of
the trusted definition, never of the request, so HTTP cannot select it.

The full feature map is in [platforms.md](platforms.md).

## Where code goes

| You are writing...                       | Put it in                                                       |
| ---------------------------------------- | --------------------------------------------------------------- |
| Money or tax arithmetic                  | `@shopper/money`, `@shopper/tax`                                |
| A mutation                               | `defineCommand()` in the owning domain package (`core`, `auth`) |
| An HTTP route                            | `@shopper/api` (Hono), mounted by `apps/edge` and `apps/box`    |
| A contract between processes or packages | A Valibot schema in the producing package                       |
| A back-office screen                     | `@shopper/backoffice` (runs in the portal and in Electron)      |
| A reusable visual component              | `@shopper/ui`                                                   |
| A generic helper with no domain meaning  | See "Shared helpers" in [code-quality.md](code-quality.md)      |
| Anything that touches a platform API     | `packages/adapters/cf` and `packages/adapters/box`, both        |
| A dev script                             | `tooling/`                                                      |

## Till storage and sync push

`@shopper/core/till` owns immutable sale snapshots and audited local recording; core never imports
sync. `@shopper/db-sqlite` owns schemas, and `@shopper/adapters-box/till` owns the Node SQLite
driver and host transports. The driver serializes the whole asynchronous transaction, including
reads, so a concurrent operation cannot enter another command's transaction.

`@shopper/sync` delivers the outbox outside local transactions. Its `./bridge` export contains only
browser-safe Valibot contracts. The till UI subscribes to WebSocket state and sends explicit
actions; credentials and cashier-session proofs stay in the host. Browser connections require an
allowed Origin and a per-start capability kept in memory. The browser capability may edit baskets, take tenders, hold/void and complete sales; private process
IPC additionally retains a recording compatibility helper and shutdown. Both sale entry points use
the same transactional completion writer.

Both HTTP hosts compose `@shopper/api/sync`. An enrolled-device principal establishes upload
scope, independently of browser and expired cashier sessions. Acceptance stores the captured sale
and lines in one audited PostgreSQL transaction; `Sequencer.assignSale` assigns its store sequence
in another. Both adapters call the shared assignment command. Replays recover persisted results
without another mutation or audit, and acknowledgment waits for sequence assignment.

Protocol negotiation and event decoding are separate contracts. Day 11 resets disposable till data:
only sync protocol 3 and sale event v3 are accepted, and older tills must update and re-bootstrap.
The sale carries tender amounts, inclusive discounts, authoritative label provenance, signed cash
rounding and receipt identity. Its original application version stays intact. The server validates
and stores corrected occurrence time, capped at acceptance, alongside raw device time. Each side
builds a versioned receipt document; receipt JSON stays out of the synced event. Completion writes
sale lines, tenders, signed stock movements and its audit atomically in each database.

Reference mutations append store-scoped changes in their audited PostgreSQL transaction.
Authenticated tills bootstrap from a versioned gzip snapshot through the Blobs port, then apply
ordered pages and the cursor in one audited SQLite transaction. Snapshot reads use the same
projections as the feed in a REPEATABLE READ transaction. Realtime carries sequence nudges;
PostgreSQL remains the source for all downloaded data. A missed nudge is recovered by reconnect
or the capped transport fallback. The host owns push, pull, realtime and receipt state; the UI
subscribes to their combined status without receiving device credentials.

## Assets and organization management

`@shopper/assets` owns publicity/access policy, purpose and bucket selection, audited asset tracking and authorized presigned grants. Provider operations use Blobs; credentials stay in adapters. The API receives metadata and asset references, never client file bytes. Before processing, resolve the tenant-owned asset and verify bounded actual bytes against its registered digest and size. A presigned URL remains a bearer capability until expiry, so repeat verification before every use.

The cloud portal, local box SPA and Electron share `@shopper/backoffice`. On-prem stores, branches, products and staff are authoritative in box PostgreSQL and available over LAN without WAN. Subscription/payment/cloud-storage/backup provisioning and cloud account setup belong to a separate cloud control plane. Local installation settings remain local. Optional cloud sync requires explicit scoped/versioned ownership contracts; two databases never become concurrent writers by implication. Desktop disconnection from its authority does not grant unrestricted offline mutations.

The owner approved this architecture on 14 October 2026. This cleanup documents it; it does not implement new management hosts, billing, backup services or Electron. TanStack Start remains the customer-shop SSR framework; management keeps the existing Router SPA.
