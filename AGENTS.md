# Shopper: rules for every agent and every human

Shopper is an offline-first supermarket POS for Ghana. Cloud (Cloudflare Workers) and on-prem
(sealed Bun binary + Rivet) share one codebase. Quality bar: no slop code and no slop UI. Every line
earns its place, and every screen looks designed.

## Read before you work

Read the doc for the area you are touching **before** you change it:

| Doc                                                                 | Read when                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------ |
| [architecture.md](docs/engineering/architecture.md)                 | Adding a file, package, dependency or import across projects |
| [layout.md](docs/engineering/layout.md)                             | Shared folder changes and the full project inventory         |
| [code-quality.md](docs/engineering/code-quality.md)                 | Writing any code (size limits, file shape, helpers, errors)  |
| [testing.md](docs/engineering/testing.md)                           | Always: tests come first                                     |
| [frontend.md](docs/engineering/frontend.md)                         | Any React, UI or UX work (no effects, design system, states) |
| [platforms.md](docs/engineering/platforms.md)                       | Cloudflare or Rivet, ports, workflows, actors, queues        |
| [deployment.md](docs/engineering/deployment.md)                     | Releases, versions, migrations, environments                 |
| [developer-experience.md](docs/engineering/developer-experience.md) | Setup, commands, tooling, git, MCP servers                   |
| [ai-workflow.md](docs/engineering/ai-workflow.md)                   | Planning, subagents, models, the Codex review loop           |

## Non-negotiable rules

- Folder names carry shared context. When several files repeat a prefix or suffix, group them
  under that feature folder and remove the repeated words from filenames. Use
  `schemas/base.ts`, `schemas/workflows.ts`, and `screens/auth/login/screen.tsx and components/auth/login/{form,success}.tsx`.
  This applies to database schemas, validation, components, hooks, commands, tests and tooling.
  Preserve required framework filenames, generated files and published migration filenames.
- Authored folders/files use nested context paths without hyphens. Explicit exceptions: framework-required names, generated files, published migrations, stable public package subpaths/URLs and tool-consumed skill/role/config identifiers. Preserve compatibility when physical files move (guard for source paths).
- `index.ts`/`index.tsx` only re-export (guard); implementations and types live in their owning
  modules. Required framework route filenames are exempt. Audit every app and package when
  applying a shared layout rule; do not stop after the first affected package.
- Hono serves HTTP on both Workers and Bun. The box uses Bun’s native server; no second HTTP framework.
- Never attribute commits or PRs to an AI assistant: no assistant authors, co-author trailers,
  generated-by footers, signatures or session links. Preserve human authorship.

- Money: integers only. 1 GHS = 10000. Use @shopper/money for ALL arithmetic. Never floats.
- Quantities: integer thousandths. Rates: integer basis points.
- IDs: UUIDv7. Never serial/autoincrement. Every table has org_id.
- Every mutation goes through defineCommand() and writes an audit row in the same transaction.
- Tax: read rules by date from the tax_rule table; snapshot tax onto every sale line.
- Never import a Cloudflare binding or a Rivet handle outside packages/adapters/*.
  Business code uses @shopper/ports, Drizzle, unstorage, Hono only. One shared function, two thin shells.
- Workflow implementations live under `workflows/`, one responsibility per module; an implementation never re-exports another workflow. Barrels only re-export (guard).
- Valibot construction belongs in owning `schemas/` modules; reusable exported types live in `types.ts` or beside their schema. SHA-256 uses `@shopper/utils`; domain canonicalization and HMAC remain separate (guard).
- Validation: Valibot only (import * as v from 'valibot'). Never add Zod.
- Cache port: never read-after-write in the same request.
- Permissions are data (role_permission). Never write `if (role === ...)`.
- Tests: integration and e2e only, written **before** the implementation. Use the Postgres 18
  fixture and golden sale fixtures.
- Any port change must update packages/conformance and pass against BOTH adapters.
- Business processes that wait on people, partners or time = a Workflow (onboarding, KYB, KYC,
  payments, orders, reviews, approvals, billing, store day). Use sleep/sleepUntil/waitForEvent;
  instance id = the business key. Never poll, never add a cron for business logic.
- Durable Objects only for hot coordination: StoreSequencer, StoreHub, FiscalLane, StockHold,
  RateLimiter. Ask before adding a sixth. Queues only for fire-and-forget fan-out.
- PostgreSQL is the record: every workflow step and DO write also writes its table and an audit
  row in one transaction, and updates workflow_run. Reports never read engine state.
- Back office code lives in @shopper/backoffice and must run in the cloud portal, local box SPA and Electron. Organize by responsibility: `screens/<context>/screen.tsx`, `components/<context>/`, `queries/<context>/`, `stores/`, `hooks/`, `schemas/`, `routes/`. The box is authoritative for on-prem operations; cloud control-plane management and optional sync are separate.
- `@shopper/assets` owns asset policy, purpose, bucket choice, audited tracking and authorized presigned grants. Browser files upload directly to R2/RustFS through presigned URLs, never through the API. Processing resolves a tenant-scoped asset and verifies bounded actual bytes against registered size/digest immediately before use. Provider transport/credentials stay behind Blobs in adapters. Filesystem fallback is only for server-generated objects; it never proxies client uploads.
- Receipts: render from receipt JSON with the shared component (Satori-safe flexbox only).
  Tills render their own PDFs; never re-render a stored PDF on view.
- Migrations are forward-only and idempotent. Breaking changes use expand-then-contract.
- Every synced event carries a version `v`; bump it and add an upcaster when its shape changes.
- Never hard-code a version string; read the build-time constants (SHOPPER_VERSION etc.).

## Enforced by `vp run guard` (CI fails)

- Apps import packages only. Apps never import apps. Packages never import apps. Nothing shipped
  imports `tooling/`. Package dependencies have no cycles. Import packages by name, never by
  relative path, and declare every `@shopper/*` import in `package.json`.
- Max 250 lines per `.ts` file and 300 per `.tsx`/`.vue`/`.astro` file. Email templates are exempt.
- No `useEffect`/`useLayoutEffect`/`useInsertionEffect`. See frontend.md for the replacements.
- No Zod. No `cloudflare:*`/`@cloudflare/*`/`rivetkit` outside adapters, edge, box, tests, tooling.

## How to work

- Understand first: read the code the change touches and trace the real flow. Then make the smallest
  change that solves it.
- Search before you write. Reuse existing helpers, schemas and components (code-quality.md lists
  where they live).
- Main export first, helpers below it. No helper sprawl, no speculative abstractions, no dead code.
- UI: use @shopper/ui only (shadcn/ui, Tailwind v4, Figma tokens). Keyboard-first on the till.
  Every action has a shortcut. Design every state. Verify in the real app with screenshots.
- Ask when a decision is the user's: product behaviour, a new dependency, a sixth DO, a layer
  change. Do not guess.

## Commands

- `vp install` · `vp run dev` · `vp check` · `vp run guard` · `vp test --run` · `vp run build`
- `vp run services:up` (PostgreSQL 18, Rivet, virtual printer) · `vp run db:migrate` · `vp run db:seed`

## Definition of done

Tests written first and green, `vp check` and `vp run guard` clean, the change reviewed with the
`pre-merge-review` skill (Codex `gpt-6.1-sol`), UI verified on screen against Figma, and docs
updated when a rule or contract changed.
