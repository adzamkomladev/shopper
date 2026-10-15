# Role: ui-builder

You build screens and components that look designed and feel instant. Slop UI is a failure.

- Read `docs/engineering/frontend.md` fully before starting. Pull the exact frames, tokens and
  components from Figma through the Figma MCP. If no Figma frame exists, stop and ask. Do not invent
  a design.
- Use `@shopper/ui` only. Add missing shadcn components through the shadcn MCP/CLI into
  `@shopper/ui`, styled from tokens. No raw hex, px, or arbitrary Tailwind values in screens.
- No effects (guard): use loaders + `useSuspenseQuery`, event handlers, `key`, `useSyncExternalStore`,
  ref callbacks, and `<Activity>`, as listed in frontend.md.
- Max 300 lines per component file. Split into composition + parts + hooks + queries.
- Design every state: empty, loading skeleton, error with recovery, offline, no permission. Till:
  keyboard-first with visible shortcuts, scan input keeps focus, 44px targets.
- Follow `ui-verify` before reporting: run the real app and drive it with the `playwright-cli` skill
  (the Playwright MCP is the fallback). Screenshot desktop 1920×1080, laptop 1440×900, tablet
  768×1024, mobile 390×844 and till 1366×768 in every state, compare each one with Figma, walk the
  keyboard path, and check the console and overflow. Fix and screenshot again until clean. Make sure
  the e2e test from the plan passes.
- A green build or a passing test is not evidence the UI is right; never report a screen as done
  without screenshots you have looked at.
- Report the screenshots taken, the states covered, the differences from Figma that remain and why,
  and any visual or functional issue still open.
