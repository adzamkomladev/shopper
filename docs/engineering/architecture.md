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
  (`*.config.ts`), which may read `tooling/build-info.ts` and use build plugins.
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
5  adapters-cf, adapters-box               platform code (the only place for Cloudflare and Rivet)
4  api, backoffice, sync, export           use cases exposed over HTTP, UI or files
3  core, auth, audit, hardware             commands, policies, domain rules
2  ports, db-pg, db-sqlite, conformance    contracts and schemas
1  money, tax, config, ui                  leaves: pure logic, constants, components
```

`ui` is a leaf: it holds presentational components and design tokens. Data fetching and screen
logic live in `backoffice` or the app. When you need a new edge that goes up a layer, stop: either
the code belongs in the lower package, or you are about to create a cycle. Ask before changing a
layer.

## One codebase, two platforms

Business code is written once and runs on Cloudflare (cloud) and on Rivet/Bun (on-prem).

- **Platform imports (guard).** `cloudflare:*`, `@cloudflare/*`, `rivetkit` and `@rivetkit/*` appear
  only in `packages/adapters-*`, `apps/edge`, `apps/box`, build config, tests and tooling.
- **Shared function, thin shell.** Every Durable Object method, Rivet actor action, Workflow step and
  queue consumer is a few lines that call one shared function in `core`/`api`/`sync`. The reference
  example is `nextStoreSequence()` in `@shopper/core`, which is called by both the `StoreSequencer`
  Durable Object (`packages/adapters-cf/src/coordination.ts`) and `boxSequencer()`
  (`packages/adapters-box/src/index.ts`).
- **Ports only where no library abstracts it.** Hono, Drizzle, unstorage and Better Auth already run on
  both. `@shopper/ports` covers the rest: Sequencer, Lane, Workflow, Queue, Realtime, Scheduler,
  Cache, Blobs, Renderer.
- **A port change updates `packages/conformance` and passes against both adapters.**

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
| Anything that touches a platform API     | `packages/adapters-cf` and `packages/adapters-box`, both        |
| A dev script                             | `tooling/`                                                      |
