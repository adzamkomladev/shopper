# Frontend, UI and UX

UI quality is a top priority. A cashier uses the till eight hours a day, and an owner judges Shopper
by the portal in the first five minutes. Every screen must look designed and feel instant. A screen
that merely works is not finished.

## Stack

- React 19 + TypeScript, `@shopper/ui` (shadcn/ui on Tailwind v4). **No other UI or CSS library.**
- Portal: TanStack Start in SPA mode (a prerendered static shell, no SSR per document) +
  TanStack Query/Table/Form. Server functions are host-only; back-office data uses the shared `/api`.
  Shop: TanStack Start (SSR). Till: the same React in Electron, and in a browser during development.
- Valibot schemas plug into TanStack Router search params and TanStack Form (Standard Schema).

## No effects (guard)

`useEffect`, `useLayoutEffect` and `useInsertionEffect` are banned in `apps/` and `packages/`.
Every common reason for an effect has a better tool:

| You want to...                                                                                    | Do this instead                                                                                                                              |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Load data for a screen                                                                            | A TanStack Router `loader` + `queryClient.ensureQueryData`, then `useSuspenseQuery` in the component. Shop: TanStack Start server functions. |
| Show loading and error states                                                                     | `<Suspense>` with a layout-shaped skeleton, and the route's `errorComponent`                                                                 |
| Compute something from props or state                                                             | Compute it during render. React Compiler memoizes, so do not hand-write `useMemo`/`useCallback` without a profile.                           |
| Reset state when an id changes                                                                    | Give the component `key={id}`                                                                                                                |
| React to a click, scan, or submit                                                                 | Do the work in the event handler                                                                                                             |
| Submit a form or write data                                                                       | TanStack Form + `useMutation`, with optimistic updates through the query cache                                                               |
| Subscribe to something outside React (online status, till-host socket, scale, clock, media query) | `useSyncExternalStore` in a hook in `@shopper/ui` or the app's store module                                                                  |
| Focus, measure, or attach a non-React widget                                                      | A ref callback that returns its cleanup function (React 19), or `autoFocus`                                                                  |
| Global keyboard shortcuts                                                                         | The shortcut registry at the app root (`onKeyDownCapture` on the root element). See below.                                                   |
| Keep a hidden screen alive (till tabs, held sales)                                                | `<Activity mode="hidden">`                                                                                                                   |
| Save something to storage                                                                         | Write it in the handler that changed it                                                                                                      |
| Track a page view                                                                                 | The router's navigation events, not the component                                                                                            |

- **Shortcuts:** wrap the app in `ShortcutRoot` (`@shopper/ui/hooks/shortcuts`). Each screen calls
  `useShortcuts({ "Mod+K": handler, N: handler })`. Combos are unique per screen, and the latest
  registered map wins a clash. Plain keys are ignored while the user types in a field.
- **Focus:** after a route or step change, move focus with the `focusOnMount` ref callback
  (`backoffice/lib/focus.ts`; `focusIfIdle` when something may already hold it). A dialog or sheet
  with no trigger button must set `onCloseAutoFocus` to put focus somewhere useful, or focus is lost
  to `<body>`.
- **Online status and the clock:** `useOnline` and `useNow(intervalMs)` in `@shopper/ui/hooks`, both
  `useSyncExternalStore`. Use `useNow` for anything "in force now" on a page left open.

If none of these fit, stop and ask. Do not work around the guard with a custom wrapper hook.

## Component structure

- Max 300 lines per `.tsx` file (guard), and logic hooks follow the 250-line `.ts` limit. Split a
  screen into parts that each have one job:

  ```text
  screens/sale/screen.tsx       composition
  components/sale/basket.tsx    basket UI
  components/sale/tender/panel.tsx
  hooks/sale/shortcuts.ts
  queries/sale.ts
  schemas/sale.ts
  ```

- Components receive data and callbacks through props. They do not fetch inside leaf components.
- Use `@shopper/ui` primitives first. Add a new shadcn component with the shadcn CLI or MCP into
  `@shopper/ui`, then style it from tokens. Never copy a component into an app.
- Add a shadcn component from `packages/ui`, with the CLI pinned in `.mcp.json`:
  `vp dlx shadcn@<pin> add <name>`. The CLI writes imports with the `#` alias
  and a `.tsx` suffix (`#components/button.tsx`). Strip the suffix after every `shadcn add`, or
  `tsc` fails. `cn` comes from the `cn` package, not a local util. Then restyle through tokens.
- Back-office screens live in `@shopper/backoffice` and must run in the portal **and** Electron:
  no Node APIs, no direct `window.electron`. Use the bridge contract.

## Design system

- **`@shopper/ui` is imported by subpath:** `@shopper/ui/components/<name>`, `/hooks/<name>`,
  `/lib/<name>` and `/styles.css`. There is no barrel file.
- **`src/styles/theme.css` is the only token file.** Light and dark values, `@theme inline`, Geist,
  and the shared utilities live there. Use `--kbd-foreground` for key hints, `--success` for
  positive states, and the `focus-ring` utility (2px background + 4px ring) for custom focusable
  surfaces. Never define tokens in an app.

- **The Figma file is the source of truth** for color, type scale, spacing, radius, shadows and
  components. Read it through the Figma MCP before building a screen. Map values to Tailwind v4
  `@theme` tokens in `@shopper/ui` once. Screens use tokens only, never raw hex, px, or arbitrary
  values like `text-[13px]` or `mt-[7px]`.
- **One exception: the receipt.** `ReceiptView` (`@shopper/hardware/receipt`) is drawn by Satori, Browser
  Run and Electron as well as the browser, so it uses inline styles in Satori's flexbox subset, whole-pixel
  sizes on a 576/384-dot canvas, black on white and the Geist font. Screens embed it (for a preview) but
  never restyle it; change the receipt there and the equivalence test proves every renderer still agrees.
- One type scale, one spacing scale (4px base), one radius set. If a design needs a value outside the
  scale, raise it with the designer rather than inventing one.
- Light and dark themes come from tokens. Icons: one set (lucide, shadcn's default), always with an
  accessible label or visible text.
- Money is always shown through the shared formatter: `GH₵ 1,234.50`, 2 dp, tabular numbers,
  right-aligned in tables. Per-kg unit prices may show 4 dp.

## Tables and data

- `DataTable` columns take `meta: { align?: "right", className? }`. Money columns use
  `align: "right"`. The file starts with `"use no memo"` because TanStack Table and Virtual return
  unstable functions the React Compiler would cache. Keep it there.
- Call the API with `apiFetch(path, schema, options)` from `@shopper/backoffice`. It validates the
  reply with Valibot and throws `ApiError` (`status`, `message`, optional `field`). Show `field`
  errors on that field (`focusFirstInvalid` moves focus to it) and the rest as a form error.
- Query keys always include the shop id (`["session", shop.id]`), so switching shops never shows
  another shop's data.
- Shop time is UTC (Ghana is GMT all year). Read and show dates through `lib/shop-time.ts`, never in
  the browser's zone.

## UX rules

- **Every screen has every state designed:** empty (with the next action), loading (a skeleton that
  matches the final layout, no spinner under 300 ms), error (what happened and how to recover),
  offline (what still works), and no permission.
- **Till:** keyboard-first, and every action has a shortcut shown on its button. The scan input
  keeps focus. The common path (scan → tender → receipt) has no dialogs and responds in under 100 ms.
  Touch targets are at least 44 px. Destructive actions (void, refund) need a manager approval, which
  uses the same keyboard flow.
- **Feedback:** every action confirms visibly. Use toasts for background results, inline messages for
  form errors next to the field, and never `alert()`.
- **Copy:** sentence case, short, specific verbs ("Charge GH₵ 45.00", not "Submit"), plain English for
  Ghanaian retail staff, no jargon or exclamation marks. Errors say what to do next.
- **Accessibility:** WCAG 2.2 AA. Visible focus, labels on every control, contrast from tokens,
  `prefers-reduced-motion` respected, and all screens usable with the keyboard alone.
- **Performance:** route-level code splitting, no layout shift, lists over 100 rows virtualized
  (TanStack Virtual), images sized and lazy.

## Verify in a real browser (every frontend change)

The `ui-verify` skill (`.agents/skills/ui-verify`) is the process, and the `playwright-cli` skill is
the tool. Start the app, open it in a real browser, and walk the nine steps before reporting:

1. Use the design system: Figma frames, `@shopper/ui`, `@theme` tokens. No raw hex, px or arbitrary
   values.
2. Build with the stack's conventions: React 19, TanStack Router/Query/Form, Tailwind v4, the app's
   existing components and patterns.
3. Run the app (`vp run dev`) and inspect it with `playwright-cli`, never from the code alone.
4. Screenshot and look at every target size: desktop 1920×1080, laptop 1440×900, tablet 768×1024,
   mobile 390×844, and till 1366×768.
5. Compare each screenshot with the design reference and correct every difference in spacing, type,
   color, radius, alignment and component use.
6. Test navigation, forms, hover and focus states, loading, empty, error, offline and no-permission
   states, and the keyboard-only path (till: shortcuts shown, scan input keeps focus).
7. Check `playwright-cli console error` for console errors and failed requests, and check every target
   width for horizontal overflow.
8. Fix every issue found, then screenshot again. Repeat until clean at every size and state.
9. Do not call the UI complete because the code compiles or the tests pass. Report the screenshots
   taken, the states covered and any remaining visual or functional issue.

The Playwright MCP stays configured as the fallback when `playwright-cli` is unavailable; the steps
do not change. The `ui-reviewer` agent repeats the loop read-only before merge.

## UI slop (rejected in review)

Generic gradients, decorative blobs, emoji as icons, random shadows and border radii, inconsistent
spacing, everything centered, walls of cards, placeholder or lorem text, "Welcome back! 👋" fluff,
icon-only buttons without labels, more than one primary button per view, spinners instead of
skeletons, modal-on-modal, disabled buttons without a reason, and color as the only signal.

## Definition of done for a screen

1. It matches the Figma frame (spacing, type, color, states), checked side by side.
2. It runs in the real app: the `ui-verify` loop above was walked with `playwright-cli`, screenshots
   were taken in every state at desktop 1920×1080, laptop 1440×900, tablet 768×1024, mobile 390×844
   and till 1366×768, and they were reviewed by the `ui-reviewer` agent. Remaining issues are
   reported, not hidden.
3. Its Playwright e2e test covers the keyboard path, all states and an axe check
   ([testing.md](testing.md)).
4. `vp check`, `vp run guard` and `vp test --run` pass.

A green build, a passing test or a clean `vp check` is never on its own enough to call a screen done.

Backoffice queries, stores, hooks and components have separate responsibility folders nested by context. Screen entries stay under `screens/`; route configuration is under `routes/`. All web/local/Electron hosts mount the same package.
