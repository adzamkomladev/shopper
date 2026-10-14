---
name: ui-screen
description: Build or change a Shopper screen or component from the Figma design with shadcn/ui, Tailwind v4 tokens, no effects, every state, keyboard-first, verified with screenshots. Use for any UI work in apps/portal, apps/shop, apps/till/ui, @shopper/ui or @shopper/backoffice.
---

# UI screen

1. Read `docs/engineering/frontend.md`. Get the Figma link from the user if you do not have it, and
   read the frames, tokens and components through the Figma MCP.
2. Make sure the tokens exist in `@shopper/ui` (`@theme`). Add missing ones there, never in a screen.
3. Write the Playwright e2e test first (`tests/e2e/<app>/`): keyboard path, every state, an axe check.
4. Build with `@shopper/ui` components (add any missing shadcn component through the shadcn MCP into
   `@shopper/ui`). Composition file + parts + hooks + queries, each within the size limits.
   No effects.
5. Run the app. Screenshot at 1366×768, 1440×900 and 390×844 in every state with the Playwright MCP.
   Compare with Figma and fix.
6. Run `pre-merge-review`, which includes the `ui-reviewer`.

## Architecture cleanup rules

Follow current `layout.md` and `code-quality.md`: no hyphens in authored paths (explicit stable/framework/generated/published exceptions); backoffice screens/components/queries/stores/hooks have separate homes nested by context; schemas and exported reusable types have owning modules; workflow modules each implement one responsibility. Reuse `@shopper/utils` SHA-256 without changing domain hash contracts. Assets use `@shopper/assets` for policy/tracking/grants and Blobs for provider transport; browser bytes upload directly to R2/RustFS and are bounded/verified immediately before processing. Never add an API byte-upload fallback. Verify both storage adapters and preserve public routes/subpaths.
