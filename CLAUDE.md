@AGENTS.md

## Claude Code specifics

- Subagents live in `.claude/agents/`. Their prompts point to `.agents/roles/`. Pick one by the
  table in `docs/engineering/ai-workflow.md`. Use `planner` before any multi-file change, and
  `reviewer` (which drives `codex review` on `gpt-6.1-sol`) before every commit.
- Skills in `.claude/skills/` (a symlink to `.agents/skills/`) are also slash commands:
  `/feature-plan`, `/tdd-slice`, `/pre-merge-review`, `/ui-screen`, `/ui-verify`, `/playwright-cli`,
  `/cloud-box-parity`, `/release`.
- Every frontend change runs the `/ui-verify` loop with `playwright-cli` (the Playwright MCP is the
  fallback) before it is reported done: real app, screenshots at desktop, laptop, tablet, mobile and
  till sizes, every state, keyboard path, console and overflow checks.
- A post-edit hook runs `vp run guard`. When it fails, fix the violation. Never edit the guard's
  baseline to get past it.
- For Cloudflare work, load the `cloudflare`, `workers-best-practices` or `durable-objects` skill
  before writing code. Use the `cf` CLI, and ask it (`cf cli search`, `cf docs search`, anonymous
  queries only) before guessing. The `wrangler` skill is for `tail`, `rollback` and `secret put` only.

- Never add Claude or another assistant as an author/contributor, co-author trailer, generated-by
  footer or session link in commits or PRs. Project settings disable all automatic attribution.
