@AGENTS.md

## Claude Code specifics

- Subagents live in `.claude/agents/`. Their prompts point to `.agents/roles/`. Pick one by the
  table in `docs/engineering/ai-workflow.md`. Use `planner` before any multi-file change, and
  `reviewer` (which drives `codex review` on `gpt-6.1-sol`) before every commit.
- Skills in `.claude/skills/` (a symlink to `.agents/skills/`) are also slash commands:
  `/feature-plan`, `/tdd-slice`, `/pre-merge-review`, `/ui-screen`, `/ui-verify`, `/skeleton-audit`, `/playwright-cli`,
  `/cloud-box-parity`, `/release`.
- Every frontend change runs the `/ui-verify` loop with `playwright-cli` (the Playwright MCP is the
  fallback) before it is reported done: real app, screenshots at desktop, laptop, tablet, mobile and
  till sizes, every state, keyboard path, console and overflow checks.
- A post-edit hook runs `vp run guard`. When it fails, fix the violation. Never edit the guard's
  baseline to get past it.
- For Cloudflare work, load the `cloudflare`, `workers-best-practices` or `durable-objects` skill
  before writing code. Use the `cf` CLI, and ask it (`cf cli search`, `cf docs search`, anonymous
  queries only) before guessing. Never use wrangler: secrets, deployments and rollback are `cf`
  commands too.

- Never add Claude or another assistant as an author/contributor, co-author trailer, generated-by
  footer or session link in commits or PRs. Project settings disable all automatic attribution.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Running Scripts

Run TypeScript and JavaScript files with `vpx <file>`, for example `vpx ./scripts/seed.ts --dry-run`. It handles enums, decorators, JSX, and tsconfig `paths`, so do not add `tsx` or `ts-node` to run scripts. `vpx --watch <file>` reruns the file when a file it uses changes, in place of `tsx watch`. `vp node <file>` runs plain Node.js.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
