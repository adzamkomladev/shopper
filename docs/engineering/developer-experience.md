# Developer experience

## Setup

Node 24.21.0 and pnpm 12.9.1 are pinned through Vite+ (`vp`). Bun is needed for the box, and Docker
for dev services.

```sh
vp install --frozen-lockfile
vp run services:up             # PostgreSQL 18, Rivet engine, virtual ESC/POS printer
vp run db:reset                # wipe, migrate and seed (or db:migrate && db:seed)
cp apps/edge/.dev.vars.example apps/edge/.dev.vars
vp run dev                     # portal :5173, till-ui :5174, shop :5175, edge :8787 in workerd
```

The seeded dev shop has the shop code `dev`. Create its owner once (details in
`apps/portal/README.md`), then sign in at http://localhost:5173:

```sh
curl -s localhost:8787/api/auth/sign-up/email -H "Origin: http://localhost:5173" -H "X-Shopper-Org: $(curl -s localhost:8787/orgs/dev | jq -r .id)" -H "X-Shopper-Bootstrap-Token: dev-only-bootstrap-token" -H "Content-Type: application/json" -d '{"name":"Dev Owner","email":"owner@dev.local","password":"dev-owner-password"}'
```

The portal's Vite server runs the portal Worker in workerd with native bindings: `/api/*` is the shared
Hono API (it strips `/api` except for `/api/auth`, which Better Auth serves under that prefix) and
`/_serverFn/*` are host-only server functions. The Durable Objects and Workflows it binds run in the
edge dev Worker on :8787. `apps/edge/.dev.vars` holds the local secrets (`.dev.vars.example` is
the template). Portal = TanStack Start in SPA mode: a prerendered static shell served by Workers Static Assets; one Worker runs only for `/api/*` (the shared Hono API through native Hyperdrive, D1, R2, Durable Object and Workflow bindings) and `/_serverFn/*` (host-only server functions). Backoffice data stays on the shared API so the box SPA and Electron reuse it.

The remote `IMPORTS` and `RECEIPTS` bindings need Cloudflare credentials. Interactive shells use the
`cf` login. A non-interactive shell (an agent, CI or a remote box) has no prompt, so export the `cf`
OAuth token first: `cf auth whoami` checks it, and then
`export CLOUDFLARE_API_TOKEN=$(jq -r .oauth_token ~/.config/cloudflare/config/default.json)`.
Copy `apps/edge/.dev.vars` to `apps/portal/.dev.vars` too: the portal Worker reads the same secrets.

On Windows: `.gitattributes` checks every text file out with LF (pnpm 12 cannot parse a CRLF
`pnpm-lock.yaml`, and fixtures are byte-exact). If an older global pnpm on `PATH` makes `vp install`
fail with `ERR_PNPM_BROKEN_LOCKFILE`, run `vp exec pnpm install --frozen-lockfile`. If a native
PostgreSQL already holds port 5432, start the container on another port and point the tools at it:
`SHOPPER_POSTGRES_PORT=5433 vp run services:up`, then set `TEST_DATABASE_URL` and `E2E_DATABASE_URL`
to `postgresql://shopper:shopper_dev_only@127.0.0.1:5433/shopper` (`/shopper_e2e` for e2e).

Use `vp` for everything. Never call `npm` in this repo: `devEngines` rejects it. Run one-off binaries
with `vp exec <bin>`. Cloudflare is driven with `cf` (`vp exec cf ...`); when unsure which command to
use, run `cf cli search "<task>"` or `cf docs search "<question>"`. Keep those queries anonymous: no
names, domains, account or resource ids, tokens. Wrangler stays only for `tail`, `rollback` and
`secret put`.

## Reset and seed

```sh
vp run db:reset [--products N] [--confirm <host>]   # drop public + drizzle schemas, migrate, seed
vp run db:seed  [--products N]           # seed an empty database (no-op once the dev org exists)
```

Both target `DATABASE_URL` (then `TEST_DATABASE_URL`, then local PG18) and print the host and
database before acting. Both run freely on localhost. Any other host needs `--confirm <host>`, and
that host must exactly match the one pg resolves; a `?host=` override counts. Anything that looks
like production is always refused: `SHOPPER_ENVIRONMENT` containing `prod`, or `prod` in the host or
database name. Data is disposable everywhere else, so staging is reset the same way. For example:
`DATABASE_URL=<staging url> vp run db:reset -- --confirm <staging host>`.

The seed goes through the real commands (provisioning, management, owner and user registration,
catalogue import): the `dev` shop with `--products` catalogue rows (default 20,000), one store, the
branches Accra Central, Osu and Kumasi Adum, one user per default role (`superadmin`, `admin`,
`accountant`, `inventory`, `cashier`) and a second shop, `dev-two`, with an owner. Emails are
`adzamkomla.dev+<300-2000>@gmail.com`, all with password `Admin@12345`. The credentials table prints
at the end and is written to `.shopper/seed/credentials.md` (gitignored, never commit it).

The dev shop also gets a delivery, reorder levels with two products already low, and one damaged
item (`tooling/database/stock.ts`), so the inventory screens are never empty. Low-stock SMS needs
`ARKESEL_API_KEY` (and optionally `ARKESEL_SENDER`, `ARKESEL_BASE_URL`) in `.env`; without it no text
is sent. Tests use the Arkesel fake.

Not seeded: branch address, phone and TIN (no columns exist), user phone numbers, and till devices
(enrolment needs a device keypair handshake).

## Daily commands

| Command                             | What it does                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `vp check`                          | Format (Oxfmt), lint (Oxlint, type-aware) and type errors                      |
| `vp check --fix`                    | Apply format and lint fixes                                                    |
| `vp run guard`                      | Repository rules: boundaries, file sizes, no effects, no Zod, platform imports |
| `vp test --run [path]`              | Integration suites (needs services up)                                         |
| `vp run e2e`                        | Playwright suites (needs Postgres and Bun)                                     |
| `vp run build` / `vp run typecheck` | Cached builds / project-reference type check                                   |
| `vp run services:down`              | Stop dev services and keep their volumes                                       |

`vp run e2e` uses its own ports so it never clashes with `vp run dev`: box 3101, portal 5183,
till-ui 5184. It builds and starts the box with Bun, so Bun must be installed. See
[testing.md](testing.md).

To run one folder of specs, call Playwright directly: `pnpm exec playwright test --project=portal tests/e2e/portal/payments`.
`vp run e2e -- <path>` runs the whole suite. Hubtel has a fake like Paystack's (`tooling/hubtel/server.ts`).

### CI layout

`.github/workflows/ci.yml` runs every job on its own runner: `check`, `guard`, `typecheck` and `build`, integration in
four shards (`vp test --run --shard=<n>/4`, each with Postgres and RustFS), e2e in three Playwright shards each
uploading its own report, and the public e2e config. The final `ci` job needs all of them; branch protection points
at it alone. A newer push to the same ref cancels the running workflow.

## Sharing the dev containers between sessions

Several sessions and test runs can share one `services:up` stack (Postgres 18, RustFS, Rivet). Each
task works in its own database and buckets and drops them when it finishes; never add a container
per task.

- **Integration tests** need nothing: each file creates and drops a `shopper_test_<uuid>` database
  (`tests/fixtures/postgres.ts`) and, when it stores objects, its own `shopper-test-<uuid>` buckets
  (`fileBucket()` in `tests/support/assets/buckets.ts`; the helpers live in
  `tooling/storage/buckets.ts`).
- **e2e runs** take a run id: `SHOPPER_RUN_ID=<1-20 lowercase letters or digits> vp run e2e`.
  `tooling/e2e/run.ts` derives everything from it:

  | Resource        | Without a run id                   | With run id `abc`                                       |
  | --------------- | ---------------------------------- | ------------------------------------------------------- |
  | Database        | `shopper_e2e`                      | `shopper_abc_e2e`                                       |
  | Imports bucket  | `shopper-imports-dev`              | `shopper-e2e-abc` (CORS for the run's portal origins)   |
  | Ports           | 3101-3104, 5183-5187               | the same plus a fixed offset (10-900) hashed from `abc` |
  | App builds      | `apps/<app>/dist`                  | `apps/<app>/.runs/abc`                                  |
  | Hosts and state | `.shopper/...`, `tests/e2e/.auth/` | `.shopper/runs/abc/`                                    |
  | Results         | `test-results/`                    | `test-results/abc/`                                     |

  The run's teardown drops its database, bucket and folders; only `test-results/abc/` stays for
  failure traces. Two ids land on the same ports about once in 90 tries; if a port is taken, pick
  another id. `playwright.public.config.ts` and `playwright.connection.config.ts` honour the same id.

- **Leftovers** from a crashed or interrupted run: `vp run services:clean -- --list` shows them and
  `vp run services:clean` drops them. It removes `shopper_test_*` and `shopper_<id>_e2e` databases
  and `shopper-test-*` and `shopper-e2e-*` buckets older than an hour (databases also need no open
  connection), and run folders with no database left. It only touches a local server (or CI), and never the fixed
  `shopper`, `shopper_e2e`, `shopper-imports-dev` or `shopper-receipts-dev`.

Redis is not part of the stack; nothing uses it.

Before you push, run: `vp check && vp run guard && vp test --run`.

## Statements, SMS and email locally (Day 17)

Statements and the KYC code go out through two fakes, so nothing real is sent in development or CI.

- **Arkesel** (SMS): `tooling/arkesel/server.ts` speaks the v2 send contract (`api-key` header, `{status:
  "success"}`), records every request and has `failNext(n)`. Point `ARKESEL_BASE_URL` at it.
- **Maileroo** (email): `tests/support/workflows/maileroo.ts` validates the strict send schema (including the PDF
  attachment), records requests and can hold a response. Point the Maileroo base URL at it.
- **Public statement URL.** A customer's link is `<portal origin>/statement/<token>`: no sign-in, a phone-first page
  with a PDF download, and 404 for a bad, expired or revoked token. Create one from a customer's Statement tab
  (Copy link), or `POST /customers/:id/statement-links`. The token is signed with `SHOPPER_LINK_SECRET`, so a link
  from one environment does not open in another.
- **Schedule.** Statements on a schedule are set under Settings > Statements; on the box the flow relaunches on boot.

## The `tooling/` folder

Tooling is anything that makes development faster or safer and never ships: `guard.ts`, database
`database/{cli,migrate,seed,e2e}.ts`, `build/info.ts`, the virtual printer, `docker-compose.dev.yml`, the Workers test
runner. Shared script helpers go in `tooling/lib/`. Apps and packages never import tooling. The only
exception is build config reading `build/info.ts`.

## Git

- Branch from `main`: `<agent-or-name>/<short-topic>`, e.g. `claude/sale-tender`, `codex/day7-sync`.
- One logical change per PR. Conventional commit subjects (`feat:`, `fix:`, `refactor:`, `test:`,
  `docs:`, `chore:`), written in the imperative.
- The PR description says what changed, why, how it was tested, and anything the reviewer should
  look at first. UI PRs include screenshots at till, desktop and mobile widths.
- AI tools are not contributors. Never add assistant authors, `Co-Authored-By` trailers,
  generated-by footers or session links to commits or PRs. `.claude/settings.json` disables
  commit/PR attribution and session links.
- Never commit secrets, `.env`, captures, `dist/`, or generated `.wrangler/` or `.cloudflare/` state.

## AI tooling in this repo

Claude Code, Codex and OpenCode all read the same rules and skills. See
[ai-workflow.md](ai-workflow.md) for agents, models and the review loop.

| Path                          | Used by                                                 | Holds                                               |
| ----------------------------- | ------------------------------------------------------- | --------------------------------------------------- |
| `AGENTS.md`                   | Codex, OpenCode (and Claude via `CLAUDE.md`)            | Project rules and the doc index                     |
| `docs/engineering/*.md`       | Everyone                                                | The detailed rules (this folder)                    |
| `.agents/skills/`             | Codex, OpenCode, Claude (`.claude/skills` is a symlink) | Shared workflows (plan, build, `ui-verify`, review) |
| `.agents/roles/`              | All three                                               | One prompt per agent role                           |
| `.claude/`                    | Claude Code                                             | Subagents, settings, guard hook                     |
| `.codex/`                     | Codex                                                   | Project config, custom agents, MCP servers          |
| `.opencode/`, `opencode.json` | OpenCode                                                | Agents, commands, MCP servers                       |
| `.mcp.json`                   | Claude Code                                             | MCP servers                                         |

### MCP servers (configured for all three tools)

| Server            | Use it for                                                            |
| ----------------- | --------------------------------------------------------------------- |
| `figma`           | Design frames, tokens, components. Needs a one-time OAuth login.      |
| `shadcn`          | Finding and adding shadcn/ui components into `@shopper/ui`            |
| `playwright`      | Fallback browser driver; prefer the `playwright-cli` skill            |
| `cloudflare-docs` | Current Cloudflare product docs and limits                            |
| `context7`        | Current docs for TanStack, Drizzle, Hono, Valibot, Rivet, Better Auth |

### Playwright CLI (frontend verification)

The `playwright-cli` skill drives a real browser with shell commands; it is the tool for
`ui-verify`, and the Playwright MCP is only the fallback when it is unavailable. The CLI is a global
tool (`npm install -g @playwright/cli@latest`, never a workspace dependency), and its skill is
installed for all three tools with:

```sh
playwright-cli install --skills=agents     # .agents/skills/playwright-cli
```

Keep `.agents/skills/playwright-cli` byte-identical to the installed version: the CLI warns when it
drifts. Screenshots and page snapshots land in `.playwright-cli/`, which is gitignored. The
repo-specific nine-step loop lives in `.agents/skills/ui-verify`.

### Till host and browser connection

The compiled Node till host starts with a private configuration file or process IPC; see
[the host README](../../apps/till/host/README.md). Configure the browser Origin explicitly, then
open its connection link. Vite proxies `/bridge` to the loopback host through
`SHOPPER_TILL_HOST_URL`. The per-start capability leaves the URL immediately and is kept in
memory; device credentials never enter browser configuration.

The Playwright MCP configurations use `tooling/mcp/playwright.mjs`, and the MCP is the fallback when
`playwright-cli` cannot run. This launcher adds `--no-sandbox` only when the process runs as root,
allowing browser review in the development container without changing non-root launches.

Run `vp run storage:setup` after starting services to initialize private imports and receipts storage/CORS in loopback RustFS. Browser imports need the `SHOPPER_S3_*` configuration documented in [deployment.md](deployment.md). The setup script contains development-only credentials and cannot target a production endpoint.

For linked worktrees, validate builds with `vp run -r --no-cache build` if Vite+ caching tries to read `.git/HEAD` as a directory. The Playwright box harness disables build caching so its bundled API always reflects current workspace dependencies rather than a previous box artifact.

Cloud imports in local workerd use the remote `shopper-imports-dev` bucket through `IMPORTS`. Keep matching R2 `SHOPPER_S3_*` signing credentials in the ignored `apps/edge/.dev.vars`; root `.env` alone does not configure the Worker. `BLOBS` remains local during development. Worker integration tests set `remoteBindings: false`, so tests cannot write cloud storage. Keep box RustFS credentials separate from the cloud files. Staging credentials and the verified direct Neon migration connection are stored in ignored `.env.staging`; files containing secrets should have mode 0600.
