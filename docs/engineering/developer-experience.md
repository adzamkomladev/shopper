# Developer experience

## Setup

Node 24.21.0 and pnpm 12.9.1 are pinned through Vite+ (`vp`). Bun is needed for the box, and Docker
for dev services.

```sh
vp install --frozen-lockfile
vp run services:up             # PostgreSQL 18, Rivet engine, virtual ESC/POS printer
vp run db:migrate && vp run db:seed
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

Use `vp` for everything. Never call `npm` in this repo: `devEngines` rejects it. Run one-off binaries
with `vp exec <bin>`.

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

Before you push, run: `vp check && vp run guard && vp test --run`.

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
- Never commit secrets, `.env`, captures, `dist/`, or generated `.wrangler/` state.

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

Run `vp run storage:setup` after starting services to initialize private imports storage/CORS in loopback RustFS. Browser imports need the `SHOPPER_S3_*` configuration documented in [deployment.md](deployment.md). The setup script contains development-only credentials and cannot target a production endpoint.

For linked worktrees, validate builds with `vp run -r --no-cache build` if Vite+ caching tries to read `.git/HEAD` as a directory. The Playwright box harness disables build caching so its bundled API always reflects current workspace dependencies rather than a previous box artifact.

Cloud imports in local workerd use the remote `shopper-imports-dev` bucket through `IMPORTS`. Keep matching R2 `SHOPPER_S3_*` signing credentials in the ignored `apps/edge/.dev.vars`; root `.env` alone does not configure the Worker. `BLOBS` remains local during development. Worker integration tests set `remoteBindings: false`, so tests cannot write cloud storage. Keep box RustFS credentials separate from the cloud files. Staging credentials and the verified direct Neon migration connection are stored in ignored `.env.staging`; files containing secrets should have mode 0600.
