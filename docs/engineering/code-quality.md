# Code quality

The bar: a reviewer reads a file top to bottom once and understands it. No slop, no ceremony.
Rules marked **(guard)** fail CI through `vp run guard`. The rest are enforced in review.

## Size limits (guard)

| File                                                    | Max lines |
| ------------------------------------------------------- | --------- |
| `.ts`, `.mts`, `.js`, `.mjs` (including tests)          | 250       |
| `.tsx`, `.jsx`, `.vue`, `.astro` (templates/components) | 300       |
| Email templates (`emails/` folders)                     | no limit  |
| Generated files (`*.gen.ts`, `*.d.ts`, migrations)      | no limit  |

Hitting the limit means the file has more than one job. Split it by responsibility: a schema file,
a command file, a query file. Do not split mechanically into `part1.ts` and `part2.ts`. The baseline
list in `tooling/guard.ts` holds files that were already too long. They may shrink but never grow.
Never add to it.

## Shape of a file

1. **The main export comes first.** A reader sees what the file does before how. Helpers follow
   below, in the order the main function calls them. Function declarations are hoisted, so this
   always works.
2. **Few helpers, and only real ones.** Extract a helper when it is reused, or when its name explains
   something a reader would otherwise have to work out. Do not extract a 2-line helper used once. Five
   tiny helpers in one file is noise. Inline them.
3. **One concept per file.** File names say what is inside (`sales/totals.ts`, not `utils.ts` or
   `helpers.ts`).
4. **Comments say why, not what.** Delete comments that restate the code. Keep the ones that explain
   a constraint, a trade-off, or a non-obvious invariant.

## Layout inside a project

Grow a project with folders, not new packages. Each app or package uses the same layout:

- **`index.ts`/`index.tsx` only re-export (guard).** No logic, no routes, no schemas, no interfaces. Code inside the
  project never imports its own `./index`. It imports the file that holds the code it needs.
- **`schemas/`** holds the project's database and Valibot schemas, one file per domain (`schemas/catalogue.ts`,
  `schemas/devices.ts`). Fields shared by several schemas go in `schemas/fields.ts`.
- **`types.ts`** holds the project's interfaces and type aliases. Types inferred from a schema stay
  next to that schema.
- **Feature folders** group code that belongs together: `routes/` (one Hono sub-app per resource,
  mounted in `app.ts`), `middleware/`, `cases/`, or a domain folder such as `catalogue/`.
- **Adapters mirror each other.** `adapters/cf` and `adapters/box` use the same file names
  (`storage`, `sequencer`, `realtime`, the workflow and launcher files).

Shared filename prefixes or suffixes belong in a folder. Use `schemas/base.ts` and
`schemas/workflows.ts`, never `base-schema.ts` and `workflow-schema.ts`. Use
`screens/auth/login/screen.tsx` and `components/auth/login/{form,success}.tsx`, never `screens/login/login-form.tsx`.
Apply the same rule to hooks, commands, queries, tests and tooling when they form a feature.
Keep `.test` and `.spec` markers. Authored path segments use no hyphens, including hooks: `hooks/catalogue/list/search.ts`. Do not rename framework entry points, generated files or published migrations.
Keep exported symbols descriptive for callers; this rule concerns file paths.

Apply shared layout changes across all apps and packages, including both adapters. Trace
imports, dynamic routes, package subpaths, build/runtime entries and docs before moving files.
Preserve published package subpaths through export mappings where needed. Framework route
filenames and generated files remain unchanged. The current workspace inventory is in
[layout.md](layout.md).

## Shared helpers live in one place

Before writing any helper, search the repo (`rg "function <idea>"`, read the owning package's
`index.ts`). Reimplementing something that already exists a few folders away is the most common
kind of slop.

| Kind of helper                                       | Home                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Domain logic (money, tax, sequence, audit, auth)     | The owning package, exported from its `index.ts`                                              |
| Validation schemas reused across packages            | The producing package (e.g. `uuidV7Schema` in `@shopper/ports`)                               |
| UI primitives, hooks, formatting for display         | `@shopper/ui`                                                                                 |
| Generic, domain-free helpers (strings, dates, async) | `@shopper/utils`. Create the package when the first helper needs it, never as an empty shell. |
| Test setup, fixtures, builders                       | `tests/fixtures/` (data) and `tests/support/` (helpers)                                       |
| Script helpers                                       | `tooling/lib/`                                                                                |

Use the standard library or the platform before writing a helper: `Intl`, `structuredClone`,
`Array.prototype.toSorted`, `Object.groupBy`, `crypto.randomUUID`, `URL`, `AbortSignal.timeout`.

## TypeScript

- Strict mode. No `any`, no `as unknown as T`, no non-null `!` without a comment saying why it holds.
- Types come from the source of truth: `v.InferOutput<typeof schema>`, Drizzle's `$inferSelect`,
  `cf workers types` for bindings. Never hand-write a type that a schema already describes.
- Validate at every trust boundary with Valibot (`import * as v from "valibot"`): HTTP input, IPC
  messages, queue payloads, workflow events, files, env. Never use Zod (guard). Inside the boundary,
  trust the types and do not re-validate.
- Prefer `type` aliases and plain functions. Use a class only when the platform requires one
  (Durable Object, `WorkflowEntrypoint`, `Error` subclasses).
- Prefer discriminated unions over boolean flags and optional fields that only make sense together.
- Use named exports only, except runtime-required entry configurations (the Bun server default export). A package's public surface is its `index.ts` plus subpaths in `exports`.

## Errors

- Throw typed errors (`class StockHoldExpired extends Error`) and map them to HTTP problems once,
  at the Hono boundary. Never return `{ ok: false }` from some functions and throw from others.
- Never swallow an error. A `catch` either handles the case completely, adds context and rethrows, or
  is not written. No `catch {}` and no `console.error` followed by carrying on.
- Fallbacks that hide data loss are bugs. If a sale cannot be recorded, the till says so.

## Naming

- Functions are verbs (`recordSale`), values are nouns (`saleTotal`), booleans are questions
  (`isVoided`, `hasManagerApproval`).
- Use business words from the domain: sale, line, tender, till, store, branch, Z-report, credit
  note. Do not invent synonyms.
- Units go in names when they are not `Money`: `delayMs`, `quantityThousandths`, `rateBps`.

## Slop checklist (reviewers reject on sight)

- Code that duplicates an existing helper, schema, or component.
- Logic, routes, schemas or interfaces in an `index.ts`.
- Speculative abstractions: an interface with one implementation, a factory for one product, options
  nobody passes, "for later" scaffolding.
- Dead code, commented-out code, unused exports, `TODO` without an owner and an issue.
- Defensive checks for states the types already rule out.
- Logging or comments that narrate the code (`// loop over items`).
- Magic numbers. Use named constants, or `@shopper/money` for any amount.
- Floats anywhere near money, quantity, or rate.
- A diff that changes things the task did not ask for.

## Dependencies

Reach for, in this order: the standard library, the platform (Web APIs, CSS, Postgres constraints),
an already-installed dependency, a few lines of our own code. A new dependency needs a reason in the
PR description: what it replaces, its size, its maintenance, and whether it runs on Workers **and**
Bun. Pin exact versions.

## Enforced responsibility ownership

Valibot schema construction belongs in `schemas/` (guard), including inline HTTP/search/provider schemas. Runtime parsing imports those schemas. Reusable exported types/interfaces belong in contextual `types.ts` or beside their owning schemas (guard); private component props can remain local.

Use `sha256` from `@shopper/utils` for lowercase hexadecimal SHA-256 (guard). Keep audit/sync canonical serialization, version projections, HMAC purpose separation and credential derivation in their domain owners.

Workflow implementations live under `workflows/`, one responsibility per module. An implementation cannot re-export another workflow (guard); `index.ts` only re-exports.

The backoffice organizes by responsibility, nested by context: screens are composition, components are screen parts, queries define reads/mutations, stores own subscriptions, hooks orchestrate UI, schemas own validation, routes wire host-owned routing. This replaces earlier screen feature-colocation guidance.

Authored paths have no hyphens (source guard). Exceptions are generated files, published migrations, required framework route names, stable public package subpaths and HTTP URLs, and tool-consumed skill/role/config identifiers. Keep compatibility mappings when renaming physical files; do not broaden exceptions to arbitrary authored folders.
