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
  no Node APIs, no direct `window.electron`. Use the bridge contract. The Inventory area's tabs
  (Stock, Records, Stock takes, Valuation, Suppliers) live in `components/inventory/tabs.tsx`, each
  shown only to members holding its permission. The Customers area's tabs live in
  `components/customers/tabs.tsx` the same way. A loader that fetches only for members who hold a
  permission uses `whenHeld` (`routes/held.ts`).

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

## The Customers area (Day 17)

`@shopper/backoffice` has one Customers area with four tabs, all drawn by `components/customers/tabs.tsx`
(`CustomersPage`): **Customers** (`/customers`), **Ageing** (`/customers/ageing`), **Identity checks** (`/kyc`,
needs `kyc.approve`) and **Loyalty** (`/settings/loyalty`, needs `customer.manage`). A tab shows only to members
who hold its permission, and the page heading names the tab. The top nav item "Customers" stays highlighted on
`/kyc` and `/settings/*`. The other settings pages (Credit, Statements, Identity checks) are reached from the
`SettingsLinks` row at the head of every settings page.

- **Customer detail** (`/customers/$id`): summary cards, then Purchases, Statement and Points tabs. Keys: E edit,
  P payment, C credit note, L limit (verified customers only), K verify identity (opens `KycStartSheet` with the
  customer as the subject), M merge, T transfer points, Alt+A archive. The Users screen offers "Verify identity" on
  a member (a role check) to members who may assign roles.
- **Every dialog and sheet** is a `usePanel` pair that returns focus to the button that opened it. Writes are
  disabled offline with an `OfflineNote`; a member who can look but not act sees a `ReadOnlyNote`.
- **Public statement page** (`/statement/$token`) never shows the nav or asks for a sign-in; it is phone-first and
  has a not-found state that says nothing about why a link failed.
- **Till:** the customer dialog (Alt+U add customer, Alt+I create invoice, Alt+E edit, Alt+R remove), the basket
  chip, the On account (Alt+5) and Points (Alt+6) tenders, and Take account payment (Alt+A). Account tenders are
  disabled offline ("Needs a connection"); drawer cash payments still work. The purchases tender filter offers
  On account and Points.
- **Figma** has frames only for Checkout, Till dashboard, Purchases and Payment. The portal customer, statement,
  ageing, merge, loyalty, KYC and settings screens and the till dialogs follow the Inventory area patterns, the
  purchases table and the shift report styles.

## The Tax area (Day 18)

`/tax` is one area with four tabs drawn by `components/tax/tabs.tsx` (`TaxPage`), all behind `tax.read`: **Summary**
(`/tax`, a range of shop dates grouped by day or month), **VAT return** (`/tax/returns?period=YYYY-MM`, last month by
default; E exports the workbook), **Rates** (`/tax/rules`; N schedules new rates, and scheduled rows can be edited or
removed, all for `tax.write`) and **Settings** (`/tax/settings`, read-only without `tax.write`). The input tax on the
VAT return is entered by members with `tax.return`. The Rates tab follows the clock (`useNow`), so a scheduled rule
moves into force at midnight without a reload. Figma has no tax frames: the screens follow the Settings and Inventory
patterns.

**Fiscal** (`/tax/fiscal`, Day 19) lists VAT invoices and credit notes on their way to the GRA SDC in five segments
(keys 1 to 5: All, Pending, Accepted, Rejected, Dead-lettered) with each one's reason, a receipt-number search (/), a
sheet per document with Retry (R, `tax.write`, dead-lettered only) and the day's hourly archive bundles to download.
It warns when no SDC is connected. It follows the Previous purchases frame (45:852). The till's purchase detail shows
each VAT invoice as Provisional or Signed.

## UX rules

- **Every screen has every state designed:** empty (with the next action), loading (a skeleton sized
  from the loaded UI measured in a browser, so nothing moves when data arrives; see the
  `skeleton-audit` skill; no spinner under 300 ms), error (what happened and how to recover),
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
