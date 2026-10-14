---
name: feature-plan
description: Plan a Shopper feature or multi-file change test-first before any code is written. Use when the user asks to build, add or change behaviour that touches more than one file, a port, money/tax, sync, or UI.
---

# Feature plan

1. Read `AGENTS.md` and the docs in `docs/engineering/` for every area involved.
2. Explore the code the change touches (spawn the `explorer` agent for wide searches). Find what
   already exists to reuse.
3. Produce the plan in the format defined in `.agents/roles/planner.md`. Spawn the `planner` agent
   for large or risky work. Plan inline for small work.
4. Put open product questions to the user, and do not continue past them.
5. Save the approved plan as `docs/plans/YYYY-MM-DD-<topic>.md` when it spans more than one session.
   Otherwise keep it in the conversation.
6. Next: `tdd-slice` for the first slice.

## Architecture cleanup rules

Follow current `layout.md` and `code-quality.md`: no hyphens in authored paths (explicit stable/framework/generated/published exceptions); backoffice screens/components/queries/stores/hooks have separate homes nested by context; schemas and exported reusable types have owning modules; workflow modules each implement one responsibility. Reuse `@shopper/utils` SHA-256 without changing domain hash contracts. Assets use `@shopper/assets` for policy/tracking/grants and Blobs for provider transport; browser bytes upload directly to R2/RustFS and are bounded/verified immediately before processing. Never add an API byte-upload fallback. Verify both storage adapters and preserve public routes/subpaths.
