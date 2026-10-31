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
| [security.md](docs/engineering/security.md)                         | Auth, sessions, new routes, audit payloads, till storage     |

## General Principles

- Keep things in one function unless composable or reusable.
- Validate unknown values once at the boundary that owns them. Pass typed values inward instead of
  repeating `typeof value === "object"` and property-existence checks. Do not defensively revalidate
  values already guaranteed by a schema, constructor, or internal type.
- Do not extract single-use helpers preemptively. Inline the logic at the call site unless the helper
  is reused, hides a genuinely complex boundary, or has a clear independent name that improves the caller.
- Before adding complexity for a speculative or vanishingly unlikely race or security edge case,
  explain the concrete failure mode, likelihood, and complexity cost to the user and get their buy-in.
  Do not silently expand scope for theoretical robustness.
- Avoid `try`/`catch` where possible.
- Avoid using the `any` type.
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary
  for exports or clarity.
- Prefer functional array methods (`flatMap`, `filter`, `map`) over for loops; use type guards on
  `filter` to maintain type inference downstream.
- Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json();

// Bad
const journalPath = path.join(dir, "journal.json");
const journal = await Bun.file(journalPath).json();
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a;
obj.b;

// Bad
const { a, b } = obj;
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2;

// Bad
let foo;
if (condition) foo = 1;
else foo = 2;
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1;
  return 2;
}

// Bad
function foo() {
  if (condition) return 1;
  else return 2;
}
```

### Complex Logic

When a function has several validation branches or supporting details, make the main function read
as the happy path and move supporting details into small helpers below it.

```ts
// Good
export function loadThing(input: unknown) {
  const config = requireConfig(input);
  const metadata = readMetadata(input);
  return createThing({ config, metadata });
}

function requireConfig(input: unknown) {
  // Validate the required configuration here.
}
```

- Keep helpers close to the code they support, below the main export when that improves readability.
- Do not over-abstract simple expressions into many single-use helpers; extract only when it names
  a real concept like `requireConfig` or `readMetadata`.
- Add comments for non-obvious constraints and surprising behavior, not for obvious assignments or
  control flow.

### Testing

- Test actual implementation; do not duplicate logic into tests.

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
- Portal = TanStack Start in SPA mode: a prerendered static shell served by Workers Static Assets; one Worker runs only for `/api/*` (the shared Hono API through native Hyperdrive, D1, R2, Durable Object and Workflow bindings) and `/_serverFn/*` (host-only server functions). Backoffice data stays on the shared API so the box SPA and Electron reuse it.
- `@shopper/assets` owns asset policy, purpose, bucket choice, audited tracking and authorized presigned grants. Browser files upload directly to R2/RustFS through presigned URLs, never through the API. Processing resolves a tenant-scoped asset and verifies bounded actual bytes against registered size/digest immediately before use. Provider transport/credentials stay behind Blobs in adapters. Filesystem fallback is only for server-generated objects; it never proxies client uploads.
- Receipts: render from receipt JSON with the shared component (Satori-safe flexbox only).
  Tills render their own PDFs; never re-render a stored PDF on view.
- Migrations are forward-only and idempotent. Breaking changes use expand-then-contract.
- Every synced event carries a version `v`; bump it and add an upcaster when its shape changes.
- Never hard-code a version string; read the build-time constants (SHOPPER_VERSION etc.).
- Every route is in the tenant sweep (`tests/integration/security/tenant/sweep.test.ts`) by default; never
  read `orgId` from a request. A new write needs a valid body in `tests/support/security/bodies.ts` (or
  `till.ts`), and a route that is public on purpose goes in the sweep's `PUBLIC` list.
- Audit payloads mask phones, TINs and Ghana Card numbers to the last 4 by key name; name fields for what they
  hold so `redact()` sees them. Never put a secret in an audit payload.

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
- Know what your checks prove. A green test that would also pass on the broken code proves
  nothing; break the change once on purpose and watch a test fail. Fix the class of bug where it
  starts, not the one instance reported. Never weaken a test, fixture or guard to get green.
- Search before you write. Reuse existing helpers, schemas and components (code-quality.md lists
  where they live).
- Main export first, helpers below it. No helper sprawl, no speculative abstractions, no dead code.
- UI: use @shopper/ui only (shadcn/ui, Tailwind v4, Figma tokens). Keyboard-first on the till.
  Every action has a shortcut. Design every state. Verify every UI change in a real browser with the
  `ui-verify` skill and `playwright-cli` (Playwright MCP as fallback) at desktop, laptop, tablet,
  mobile and till sizes; a green build is never proof on its own.
- Ask when a decision is the user's: product behaviour, a new dependency, a sixth DO, a layer
  change. Do not guess.

## Commands

- `vp install` · `vp run dev` · `vp check` · `vp run guard` · `vp test --run` · `vp run build`
- `vp run services:up` (PostgreSQL 18, Rivet, virtual printer) · `vp run db:migrate` · `vp run db:seed`

## Definition of done

Tests written first and green, `vp check` and `vp run guard` clean, the change reviewed with the
`pre-merge-review` skill (Codex `gpt-6.1-sol`), UI verified in the real app with the `ui-verify` loop
(`playwright-cli`) against Figma and reported with its remaining issues, and docs updated when a rule
or contract changed.
