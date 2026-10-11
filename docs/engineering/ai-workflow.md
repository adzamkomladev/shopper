# AI workflow: agents, models and the review loop

Claude Code, Codex and OpenCode work on this repo under the same rules (`AGENTS.md` +
this folder), the same skills (`.agents/skills/`), and the same role prompts (`.agents/roles/`).
Only the model behind each role differs per tool.

## The loop for every task

1. **Plan** (`feature-plan` skill, `planner` agent). The output is a short plan: behaviours written as
   test names, files to touch, the shared function plus the cloud and box shells, UI states, and
   risks. For anything bigger than a one-file fix, the user approves the plan first.
2. **Tests first** (`test-author` agent). Failing integration/e2e tests that encode the plan.
3. **Build** (`tdd-slice` skill, main agent or `implementer`/`ui-builder`). The smallest code that turns
   the tests green, one slice at a time.
4. **Check** (`checker` agent): `vp check`, `vp run guard`, `vp test --run`. Fix and repeat.
5. **Review** (`pre-merge-review` skill, `reviewer` agent, which runs Codex `gpt-6.1-sol`). UI changes
   also go through `ui-reviewer` with screenshots. Fix every confirmed finding.
6. **Commit / PR** with the description from
   [developer-experience.md](developer-experience.md#git).

Skip a subagent when the work is small enough that briefing it costs more than doing it.

## Roles and models

| Role          | Job                                                         | Claude Code                                | Codex                                        | OpenCode                                      |
| ------------- | ----------------------------------------------------------- | ------------------------------------------ | -------------------------------------------- | --------------------------------------------- |
| main session  | Drives the loop, small edits, talks to the user             | Opus, effort low (medium for complex work) | `gpt-6.1-sol` low (medium for complex work)  | `deepseek-v4.1-flash`                         |
| `planner`     | Turns a request into an approved, test-first plan           | Opus, high (medium for small)              | `gpt-6-astra` medium (or `gpt-6.1-sol` high) | `deepseek-v4-pro`                             |
| `explorer`    | Read-only search: where things are, how they work           | Haiku, low                                 | `gpt-6.1-sol` low                            | `qwen3.8-flash`                               |
| `test-author` | Writes the failing integration/e2e tests from the plan      | Sonnet, high                               | `gpt-6-luna` high                            | `glm-5.3-flash`                               |
| `implementer` | Makes a planned slice pass, backend and packages            | Sonnet, medium                             | `gpt-6.1-sol` medium                         | `deepseek-v4.1-flash`                         |
| `ui-builder`  | Builds screens/components from Figma per frontend.md        | Sonnet, high                               | `gpt-6-luna` xhigh                           | `glm-5.3-flash`                               |
| `checker`     | Runs check/guard/tests, returns only the failures           | Haiku, medium                              | `gpt-6.1-sol` low                            | `qwen3.8-flash`                               |
| `reviewer`    | Runs Codex review (`gpt-6.1-sol` medium), verifies findings | Sonnet, low (drives `codex review`)        | `gpt-6.1-sol` medium                         | `deepseek-v4.1-flash` (drives `codex review`) |
| `ui-reviewer` | Screenshots + Figma comparison + a11y and UX slop check     | Sonnet, high                               | `gpt-6-luna` high                            | `glm-5.3-flash`                               |

Choosing effort: use the lowest setting that will get it right the first time. Raise it for money,
tax, sync, migrations, auth and anything concurrent. A wrong answer there costs more than tokens.

Haiku at higher effort (`medium`, `high`, `xhigh`) suits mechanical but long jobs: bulk renames
across many files, or summarizing a long test log. Spawn the `explorer` or `checker` with a higher
effort when the task needs it.

## Codex review from any tool

```sh
# Pick one target: --uncommitted (local work), --base main (a branch), or --commit <sha>
codex review --uncommitted -c model="gpt-6.1-sol" -c model_reasoning_effort="medium"

# Focused review: custom instructions replace the target flag, so name the scope in the prompt
codex review -c model="gpt-6.1-sol" -c model_reasoning_effort="medium" \
  "Review the uncommitted changes (git diff HEAD plus untracked files), focusing on <area>."
```

Codex always loads `AGENTS.md`, so both forms review against the repository rules. A target flag
and custom instructions cannot be combined (the CLI rejects it).

The reviewer agent verifies each finding against the code before reporting it, and drops false
positives with a one-line reason. Use `low` effort for small diffs and `medium` for anything touching
money, tax, sync, auth or migrations.

## How each tool is wired

- **Claude Code** reads `CLAUDE.md`, which imports `AGENTS.md`. Subagents are in `.claude/agents/`,
  and skills (also slash commands) come from `.claude/skills` → `.agents/skills`. A post-edit hook
  runs the guard. MCP servers are in `.mcp.json`. Default model and effort are in
  `.claude/settings.json`.
- **Codex** reads `AGENTS.md`. Custom agents are in `.codex/agents/*.toml`, skills come from
  `.agents/skills` (invoke with `$name`), and MCP servers and defaults are in `.codex/config.toml`.
- **OpenCode** reads `AGENTS.md`. Agents are in `.opencode/agents/`, slash commands in
  `.opencode/commands/` (each one loads the matching skill), and skills come from
  `.agents/skills`. MCP servers and default models are in `opencode.json`.

To change a role's behaviour, edit `.agents/roles/<role>.md` once. To change a model, edit that
tool's agent file and the table above.
