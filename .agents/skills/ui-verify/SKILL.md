---
name: ui-verify
description: Verify a frontend change in a real browser before it is done - screenshots at desktop, laptop, tablet and mobile, every state, the keyboard path, console errors and layout overflow. Use after building or changing any screen or component in apps/portal, apps/shop, apps/till/ui, @shopper/ui or @shopper/backoffice, and for every ui-reviewer pass.
---

# Verify UI in a real browser

Code that compiles and tests that pass are not evidence the UI is right. Load the `playwright-cli`
skill for command syntax and run the loop below for every frontend change. Use the Playwright MCP
only as the fallback when the CLI is unavailable.

1. **Design system.** Read `docs/engineering/frontend.md`, pull the frames and tokens from Figma,
   and build from `@shopper/ui` and its `@theme` tokens. No raw hex, px or arbitrary values.
2. **Run the real app.** `vp run dev` (portal 5173, till-ui 5174, shop 5175), or reuse the e2e stack
   that `vp run e2e` leaves up (portal 5183, till-ui 5184 with the two e2e shops). Then
   `playwright-cli open <url>`, and sign in as the owner — with the e2e stack,
   `playwright-cli state-load tests/e2e/.auth/owner.json` skips the sign-in form. Do not verify a
   mock or a story.
3. **Screenshot every target size and look at each one:** desktop 1920×1080, laptop 1440×900,
   tablet 768×1024, mobile 390×844, plus 1366×768 for the till.

   ```bash
   playwright-cli resize 1440 900
   playwright-cli screenshot --full-page --filename=.playwright-cli/<screen>-laptop.png
   ```

   Read the PNGs back. A screenshot you did not look at proves nothing.

4. **Compare with the design references** side by side: spacing, type scale, color tokens, radius,
   alignment, component use. Correct every difference.
5. **Walk the task in the browser:** navigation, forms, hover and focus states, loading, empty,
   error, offline and no-permission states, and the whole path with the keyboard alone. On the till,
   check the shortcut shown on every button and that the scan input keeps focus. If the change
   touches a skeleton or what it stands in for, run the `skeleton-audit` skill too.
6. **Check the console and the layout.**

   ```bash
   playwright-cli console error            # errors and failed calls: must be clean
   playwright-cli requests --filter "/api/"
   playwright-cli eval "document.documentElement.scrollWidth > window.innerWidth"
   ```

   The overflow expression must be `false` at every target width.

7. **Fix what you found and run the loop again:** `playwright-cli reload`, screenshot, compare.
   Repeat until it holds at every size and state.
8. **Clean up.** `playwright-cli close`, and keep screenshots out of the diff: write them under
   `.playwright-cli/`, which is ignored.
9. **Report honestly.** The change is not complete because the code compiles or the tests pass.
   Report the screenshots taken, the states covered, and every visual or functional issue that
   remains, with what it would take to resolve it.

## Fallback: Playwright MCP

The Playwright MCP stays configured in all three tools (`tooling/mcp/playwright.mjs`). Use it when
`playwright-cli` is not installed or cannot launch a browser; the loop is the same, the tool names
differ (`browser_navigate`, `browser_resize`, `browser_take_screenshot`, `browser_console_messages`,
`browser_snapshot`).

## Installing or updating the CLI skill

```bash
playwright-cli install --skills=agents     # writes .agents/skills/playwright-cli (shared)
playwright-cli install --skills=claude     # writes .claude/skills/playwright-cli
```

Keep `.agents/skills/playwright-cli` byte-identical to the tool: it warns on every run when it
drifts, and the installer overwrites local edits. Repo-specific steps live in this skill, not there.
