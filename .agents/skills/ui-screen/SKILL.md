---
name: ui-screen
description: Build or change a Shopper screen or component from the Figma design with shadcn/ui, Tailwind v4 tokens, no effects, every state, keyboard-first, verified in a real browser with playwright-cli before it is done. Use for any UI work in apps/portal, apps/shop, apps/till/ui, @shopper/ui or @shopper/backoffice.
---

# UI screen

Every screen follows the same nine steps. Steps 3 to 9 are not optional, and a green build is not
the finish line.

1. **Design system.** Read `docs/engineering/frontend.md`. Get the Figma link from the user if you do
   not have it, and read the frames, tokens and components through the Figma MCP. Check the tokens
   exist in `@shopper/ui` (`@theme`); add missing ones there, never in a screen.
2. **Conventions.** Use `@shopper/ui` components (add a missing shadcn component through the shadcn
   MCP into `@shopper/ui`), the app's React/TanStack Router/Query/Form patterns, and Tailwind v4
   tokens only. No effects. Composition file plus parts, hooks, queries and schemas, each inside its
   size limit.
3. **Test first.** Write the Playwright e2e test (`tests/e2e/<app>/`): keyboard path, every state, an
   axe check, and a screenshot at each target size.
4. **Build it.** The smallest change that makes the test pass. Every state gets a design: empty,
   loading skeleton, error with recovery, offline, no permission.
5. **Run the real app** (`vp run dev`) and load the `ui-verify` skill. Verify with `playwright-cli`,
   not from the code: open the page in the browser.
6. **Screenshot and inspect** desktop 1920×1080, laptop 1440×900, tablet 768×1024, mobile 390×844,
   and 1366×768 for the till. Read every PNG back and compare it with the Figma frames; correct each
   difference.
7. **Test behaviour:** navigation, forms, hover and focus states, loading, empty, error and offline
   states, the keyboard-only path, console errors and horizontal overflow at every width.
8. **Fix and repeat.** Fix everything found, reload, screenshot again. Repeat until it holds at every
   size and state.
9. **Report.** Do not report the screen as done because the code compiles or tests pass. Report the
   screenshots taken and any visual or functional issue that remains, then run `pre-merge-review`
   (which includes the `ui-reviewer`).

## Architecture cleanup rules

Follow current `layout.md` and `code-quality.md`: no hyphens in authored paths (explicit stable/framework/generated/published exceptions); backoffice screens/components/queries/stores/hooks have separate homes nested by context; schemas and exported reusable types have owning modules; workflow modules each implement one responsibility. Reuse `@shopper/utils` SHA-256 without changing domain hash contracts. Assets use `@shopper/assets` for policy/tracking/grants and Blobs for provider transport; browser bytes upload directly to R2/RustFS and are bounded/verified immediately before processing. Never add an API byte-upload fallback. Verify both storage adapters and preserve public routes/subpaths.
