# Workspace source layout

Apply the folder rule to every app and package, including nested adapters. A folder carries shared
context; sibling names describe their distinct responsibility. Do not repeat the feature as a
filename prefix or suffix. Preserve exported symbol names and public package subpaths.

`index.ts` and `index.tsx` only re-export (guard). Framework route files, generated bindings/route
trees and published migrations retain their required names. Executable code lives in the owning
module; re-exporting that module preserves startup side effects.

The source inventory covers every app/package project, including the assets and utils additions:

| Project                 | Source organization                                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/box`              | `app.ts`, `server.ts`, `types.ts`; re-export entry                                                                                                                         |
| `apps/edge`             | `worker.ts`, `types.ts`; Worker and platform class re-exports                                                                                                              |
| `apps/portal`           | `router.tsx`, `server.ts`, `worker.ts`, `functions/` (host-only server functions), `components/`, `routes/`                                                                |
| `apps/till/ui`          | `app.tsx`, `connection/store.ts`, `screens/connection/`; re-export HTML entry                                                                                              |
| `apps/till/host`        | `server.ts` starts the compiled Node host through the box adapter; private IPC/config-file entry                                                                           |
| `apps/till/electron`    | `main.ts` forks the till host and shows the till UI; `render.ts` prints receipts (`printToPDF`, `capturePage`)                                                             |
| `apps/shop`             | TanStack `routes/`; required route names retained                                                                                                                          |
| `packages/auth`         | `session/`, `devices/`, `schemas/`, roles and users                                                                                                                        |
| `packages/core`         | `catalogue/`, `schemas/{catalogue,till}/`, `till/` local commands, `sales/` ingest and assignment                                                                          |
| `packages/backoffice`   | `screens/`, `components/`, `queries/`, `stores/`, `hooks/`, `schemas/`, `routes/`; each nested by context                                                                  |
| `packages/ui`           | `components/input/`, `components/table/`, other distinct primitives, hooks and styles                                                                                      |
| `packages/config`       | `build.ts`; metadata re-export                                                                                                                                             |
| `packages/conformance`  | `register.ts`, `cases/`, `types.ts`; API re-exports                                                                                                                        |
| `packages/db/pg`        | `schemas/`, `types.ts`, forward-only migrations                                                                                                                            |
| `packages/db/sqlite`    | `schemas/{cache,till}/`, `cache.ts`, `till.ts`; cache and durable till schemas                                                                                             |
| `packages/api`          | `app.ts`, `routes/`, `sync/`, `middleware/`, `schemas/`, `runtime.ts`, `types.ts`                                                                                          |
| `packages/audit`        | Command and chain modules, `sqlite/` command adapter, `schemas/`, `types.ts`                                                                                               |
| `packages/ports`        | Port modules, `schemas/`, `types.ts`                                                                                                                                       |
| `packages/money`        | Arithmetic and formatting modules, `schemas/`                                                                                                                              |
| `packages/tax`          | Snapshot and rule modules, `schemas/`                                                                                                                                      |
| `packages/adapters/cf`  | Thin database, storage, coordination shells; `workflows/{auth,price}.ts`                                                                                                   |
| `packages/adapters/box` | Thin platform shells; `till/database.ts` and `till/host/` own Node durability and transports                                                                               |
| `packages/hardware`     | ESC/POS encoder, printer profiles, receipt encoding, QR matrix; `./network` TCP driver, `./receipt` shared receipt view, `./render` HTML/PDF/fonts, render IPC `./schemas` |
| `packages/sync`         | `push/` delivery and acknowledgments, `versions.ts`, browser-safe `bridge/` contracts                                                                                      |
| `packages/export`       | Empty future package entry; no implementation to reorganize                                                                                                                |

UI's established `components/input`, `components/input-group`, `components/table` and
`components/data-table` imports remain stable through explicit package export mappings. The
physical files use `input/{control,group}.tsx` and `table/{primitive,data}.tsx`. After adding a
registry component, apply the folder rule to any related existing files and update imports/exports.

Tests follow the same layout: `integration/catalogue/import/{run,errors,large,limits,messy,rules}.test.ts`,
`integration/workflows/price/change/{run,edges}.test.ts`, and
`integration/auth/devices/enrollment.test.ts and pin/login.test.ts`, with setup/support alongside each group.
Tooling groups build scripts under `build/{info.ts,server.mjs}` and database scripts under
`database/{cli,e2e,migrate,seed}.ts`.

Before calling a shared cleanup complete, check every project, imports and lazy imports, package
exports, build/runtime entries, READMEs and engineering examples. Run the guard, checks, builds,
integration suites and relevant browser flows. Leave unrelated singleton modules intact.

Till integration groups are `integration/till/{storage,sales}/`, `integration/sync/` and
`integration/till/host/`. Shared process and browser fixtures live in
`support/till/{host,connection}/`; golden snapshots live in `fixtures/sales/`.

`@shopper/assets` owns access/purpose/bucket policy, audited asset tracking and grants. `@shopper/utils` is a dependency-free leaf with the concrete SHA-256 helper.

Authored source paths use no hyphens (guard). Required framework route names, generated bindings, published migrations, stable public package subpaths/URLs and tool-consumed skill/role/config identifiers are preserved exceptions. Existing engineering-document and published plan URLs retain their link contracts. New documents use nested context paths.

Backoffice screens contain composition entries, components contain screen parts, queries contain reads/mutations, stores subscriptions, hooks UI orchestration, schemas validation and routes host wiring. Existing styles and screen improvements are preserved. There are no required framework route filenames in backoffice; it builds routes explicitly. The customer shop retains TanStack required route files.

Implementation workflows live in `workflows/` with one responsibility per module; barrels only re-export. Reusable types belong in contextual `types.ts`; schema-inferred types stay beside schemas. The rename inventory is in [architecture layout plan](../plans/architecture/layout.md).
