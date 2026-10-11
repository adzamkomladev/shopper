# Developer experience

## Setup

Node 24.21.0 and pnpm 12.9.1 are pinned through Vite+ (`vp`). Bun is needed for the box, and Docker
for dev services.

```sh
vp install --frozen-lockfile
vp run services:up             # PostgreSQL 18, Rivet engine, virtual ESC/POS printer
vp run db:migrate && vp run db:seed
vp run dev                     # portal :5173, till-ui :5174, shop :5175, edge in workerd
```

Use `vp` for everything. Never call `npm` in this repo: `devEngines` rejects it. Run one-off binaries
with `vp exec <bin>`.

## Daily commands

| Command                             | What it does                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `vp check`                          | Format (Oxfmt), lint (Oxlint, type-aware) and type errors                      |
| `vp check --fix`                    | Apply format and lint fixes                                                    |
| `vp run guard`                      | Repository rules: boundaries, file sizes, no effects, no Zod, platform imports |
| `vp test --run [path]`              | Integration suites (needs services up)                                         |
| `vp run build` / `vp run typecheck` | Cached builds / project-reference type check                                   |
| `vp run services:down`              | Stop dev services and keep their volumes                                       |

Before you push, run: `vp check && vp run guard && vp test --run`.

## The `tooling/` folder

Tooling is anything that makes development faster or safer and never ships: `guard.ts`, database
`migrate`/`seed`, `build-info.ts`, the virtual printer, `docker-compose.dev.yml`, the Workers test
runner. Shared script helpers go in `tooling/lib/`. Apps and packages never import tooling. The only
exception is build config reading `build-info.ts`.

## Git

- Branch from `main`: `<agent-or-name>/<short-topic>`, e.g. `claude/sale-tender`, `codex/day7-sync`.
- One logical change per PR. Conventional commit subjects (`feat:`, `fix:`, `refactor:`, `test:`,
  `docs:`, `chore:`), written in the imperative.
- The PR description says what changed, why, how it was tested, and anything the reviewer should
  look at first. UI PRs include screenshots at till, desktop and mobile widths.
- Never commit secrets, `.env`, captures, `dist/`, or generated `.wrangler/` state.

## AI tooling in this repo

Claude Code, Codex and OpenCode all read the same rules and skills. See
[ai-workflow.md](ai-workflow.md) for agents, models and the review loop.

| Path                          | Used by                                                 | Holds                                       |
| ----------------------------- | ------------------------------------------------------- | ------------------------------------------- |
| `AGENTS.md`                   | Codex, OpenCode (and Claude via `CLAUDE.md`)            | Project rules and the doc index             |
| `docs/engineering/*.md`       | Everyone                                                | The detailed rules (this folder)            |
| `.agents/skills/`             | Codex, OpenCode, Claude (`.claude/skills` is a symlink) | Shared workflows (plan, build, review, ...) |
| `.agents/roles/`              | All three                                               | One prompt per agent role                   |
| `.claude/`                    | Claude Code                                             | Subagents, settings, guard hook             |
| `.codex/`                     | Codex                                                   | Project config, custom agents, MCP servers  |
| `.opencode/`, `opencode.json` | OpenCode                                                | Agents, commands, MCP servers               |
| `.mcp.json`                   | Claude Code                                             | MCP servers                                 |

### MCP servers (configured for all three tools)

| Server            | Use it for                                                                    |
| ----------------- | ----------------------------------------------------------------------------- |
| `figma`           | Design frames, tokens, components. Needs a one-time OAuth login.              |
| `shadcn`          | Finding and adding shadcn/ui components into `@shopper/ui`                    |
| `playwright`      | Running the app, screenshots, checking keyboard flows                         |
| `cloudflare-docs` | Current Cloudflare product docs and limits                                    |
| `context7`        | Current docs for TanStack, Drizzle, Hono, Valibot, Rivet, Better Auth, Elysia |
