# Day 6: UI kit from Figma + portal shell

## Context

This is Day 6 of the 45-day plan ([Notion row](https://app.notion.com/3eba2c999ce9819a9345c5b78aa97bb1)).

- **Goal:** one shared component library, built on **shadcn/ui**, used by the till, the portal and the shop, and styled from the designer's Figma.
- **Done when:** the portal looks like the Figma, and the same components import cleanly into `apps/till-ui`.
- **Integration test:** Playwright logs in, creates a product, and sees it in the list.

The Day-5 plan also moved the catalogue, price and import screens to today.

Starting point:
- `@shopper/ui` exports only an `About` component.
- `@shopper/backoffice` is empty.
- The portal is a one-route TanStack Router stub.
- Tailwind, shadcn, TanStack Query, Form and Table, and Playwright are not installed.
- The Day-5 catalogue API is complete.

**Decisions taken by the user:**
- **Tenant:** a "Shop code" (the org slug) at login, looked up through a new public `GET /orgs/:slug`. Shops are remembered on the device, and the org switcher lists them. The box hides the field (fixed `SHOPPER_ORG_ID`).
- **Figma till frames** (barcode scanner, purchases) are a **style reference only**. Till sale screens come on days 8–10.
- **Login** uses email + password. Figma says "Username"; we relabel it Email.
- **shadcn/ui is the component base.** The Figma components are shadcn ones (the docs links are on each component). Every primitive is added with the shadcn CLI or MCP into `@shopper/ui`. Nothing is hand-rolled, and nothing is copied into apps.

**Data is disposable:** reset the dev DB, D1, KV and DO freely. Commit after each slice. Push only at the end, then update Notion.

**Planner defaults I'm taking.** Change them on approval if you disagree:
- The product list shows the current org-wide price and sorts newest first.
- One session per origin for now (per-org cookie prefix deferred).
- Accept the React Compiler via `@rolldown/plugin-babel`.
- Category and supplier comboboxes offer an inline "Create '…'".
- Dark mode follows the OS, with no toggle.

Branch: `claude/day6-ui-kit-portal` off `main`. Saved to the repo as `docs/plans/2026-10-11-day6-ui-kit-portal.md` in slice 0.

## Figma → tokens (file `4MtEIWv8yBUBYgkrk4ubPk`)

**Frames:**
- 12-66: Input
- 9-61: login flow plus a "Login Completed" card
- 27-2031 and 45-852: the shell and table language

**Theme:** shadcn new-york, slate base.

| Token | Value |
|---|---|
| `--primary` | `#155058` (foreground white) |
| `--foreground` | `#020617` |
| `--muted`, `--secondary` | `#f1f5f9` |
| `--muted-foreground` | `#64748b` |
| `--border`, `--input` | `#e2e8f0` |
| `--destructive` | `#dc2626` |
| `--radius` | 8px (inputs 6px) |
| Font | Geist, self-hosted (the box is offline) |
| Focus ring | 2px background + 4px primary |
| Page tint | `#f0fdf4` |
| Shell | Teal backdrop with a 20px rounded white panel |

**Shell:**
- Top nav: org combobox, text links, search input, avatar.
- H1 is `text-3xl` bold.
- Card table: search input-group, filters, underline tabs, a muted/50 header, 66px two-line rows, badges, right-aligned totals.

**Dark theme:** slate dark with a lightened primary. Figma has no dark design.

## Behaviours as tests (written first by `test-author`)

**Integration (Vitest + PG18 fixture)**

`tests/integration/api/org-lookup.test.ts`:
- a shop code resolves to only `{id, name}`, with no session or tenant header
- matching ignores case and surrounding spaces
- an unknown code returns 404
- in the cloud, `/orgs/current` returns 404
- on the box, `/orgs/current` returns the fixed org, and other codes return 404
- `provisionOrg` stores the slug it is given

`tests/integration/catalogue/views.test.ts`:
- list, detail, price, category, supplier, import preview and import record responses all parse with the published view schemas
- the hand-written `ProductDetail` in `catalogue/support.ts` is replaced by the inferred type

`tests/integration/catalogue/errors.test.ts`:
- a duplicate SKU returns 409 with `field: "sku"`
- a duplicate barcode returns 409 with `field: "barcodes"`
- an invalid body returns 400 naming the field path

**E2E (Playwright, real box API + PG18 + Vite portal, no mocks)**, under `tests/e2e/portal/`:

`auth.setup.ts` signs up an owner per e2e org with the bootstrap token, creates the branch "Accra Central", and saves `storageState`.

`login.spec.ts`:
- keyboard-only sign-in with shop code, email and password lands on products
- an unknown shop code shows an error on the field
- a wrong password keeps the code and shows a form error
- sign-out returns to login with the code prefilled
- the switcher lists remembered shops, and picking one without a session opens login prefilled
- axe, plus screenshots at 1366, 1440 and 390

`catalogue.spec.ts`:
- **log in, create a product, and see it in the list**
- an empty catalogue offers "Add product" and "Import spreadsheet"
- search by name, SKU or barcode, with a "no match, clear search" state
- Mod+K finds and opens a product
- N opens the new-product sheet and Esc closes it
- a duplicate SKU shows its error on the field
- offline shows a banner and disables Save
- a loading skeleton shows (CDP throttling)
- axe and screenshots

`product.spec.ts`:
- an edit persists after reload
- a pack barcode with quantity 24 can be added and removed
- setting a price with a reason shows GH₵ 12.50 in the history
- a branch override shows
- a scheduled window shows as upcoming
- an unknown id shows Not found with a way back
- axe

`import.spec.ts`:
- a messy-file dry run reports bad rows by row and column and writes nothing
- running the import adds the good rows
- axe

`tests/e2e/till-ui/smoke.spec.ts`:
- the till renders `@shopper/ui` Button and Card with the shared theme: the computed background equals `--primary`

## Changes

**Dependencies.** All pinned exact. Check each with context7 or npm before installing.

| Where | Packages |
|---|---|
| root devDeps | `@tailwindcss/vite` 4.x, `babel-plugin-react-compiler` 1.0.0, `@rolldown/plugin-babel` |
| `tests` | `@playwright/test`, `@axe-core/playwright` |
| `packages/ui` | `tailwindcss`, `tw-animate-css`, `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`, `cmdk`, `@tanstack/react-table`, `@tanstack/react-virtual`, `@fontsource-variable/geist` |
| `packages/backoffice` | `@tanstack/react-query`, `@tanstack/react-form`, `@tanstack/react-router` 1.170.41, `valibot` |

shadcn itself is never a dependency. It runs as `vp dlx shadcn@<pin from .mcp.json>` or through the shadcn MCP.

**@shopper/core**
- `src/orgs.ts`: `findOrgBySlug` and `findOrg`.
- `src/schemas/catalogue-views.ts`: response schemas (`productSummary`, `productPage`, `productDetail`, `priceView`, `categoryView`, `supplierView`, `importPreview`, `importRecord`, `orgSummary`).
- New `"./schemas"` export with re-exports only.
- `listProducts`: add the current org-wide price (lateral join) and a newest-first keyset.

**@shopper/api**
- `src/routes/orgs.ts`: `GET /orgs/current` and `GET /orgs/:slug`.
- `src/runtime.ts`: dispatch `/orgs/*` before the origin and tenant checks. These routes are read-only and GET-only.
- Catalogue `onError` adds `field`. Move the mapping to `src/middleware/problem.ts` if `catalogue.ts` would pass 250 lines.
- The edge and box shells are unchanged.

**tooling/seed.ts:** `provisionOrg` takes `slug`, and the dev org gets `slug: "dev"`. Reset the dev DB.

**@shopper/ui (shadcn/ui, presentation only)**
- `components.json`: new-york, slate, CSS variables, `tailwind.css: src/styles/theme.css`.
- `package.json` exports `./components/*`, `./hooks/*`, `./lib/*` and `./styles.css`.
- `src/styles/theme.css` is the single token file. It holds `@theme inline` with the Figma tokens in oklch, light and dark, imports Geist and tw-animate, and declares its own `@source`.
- **shadcn components (CLI/MCP):** button, input, label, select, dialog, sheet, sonner, command, popover, dropdown-menu, table, badge, avatar, card, skeleton, field, input-group, kbd, empty, switch, alert, tabs.
- Restyle only through tokens and variants, never forks.
- Composed on top of shadcn:
  - `data-table.tsx`: TanStack Table + Virtual, a sticky muted header, 66px rows, `onEndReached`.
  - `money.tsx`: reuses `formatGHS` from `@shopper/money`, tabular figures, right-aligned.
  - `app-backdrop.tsx`
  - `hooks/use-online.ts`: `useSyncExternalStore`.
  - `hooks/shortcuts.tsx`: `ShortcutRoot` with `onKeyDownCapture`, and a ref-callback `useShortcuts`. No effects.
- `About` moves to `components/about.tsx`.

**@shopper/backoffice** (layer 4). Mounted by the portal now and by Electron on day 13.
- `src/routes.tsx`, `createBackofficeRoutes(rootRoute)`:
  - `/login`
  - a `_shop` layout whose `beforeLoad` runs `ensureQueryData(session)` and otherwise redirects to `/login?shop=`
  - `/products`, `/products/$productId`, `/imports`
  - every route uses `lazyRouteComponent`, a `pendingComponent` skeleton, and the shared `errorComponent` (403 → no permission, 404 → not found, otherwise retry)
- `src/api/client.ts`, `apiFetch`:
  - calls same-origin `/api` with credentials and `X-Shopper-Org`
  - parses responses with the view schemas
  - throws `ApiError {status, message, field}`
- `src/shops/shop-store.ts`: shops kept in localStorage, read with `useSyncExternalStore`.
- `src/schemas/forms.ts`: the price form maps a decimal string through `fromDecimal` to Money. Product forms reuse `productInput` and `productPatch`.
- Screen folders, each with `*-screen.tsx`, part files, `queries.ts` and `use-*-shortcuts.ts`:

| Screen | Parts | States | Shortcuts |
|---|---|---|---|
| `login/` (Figma 9-61) | shop code → email → password → Login; success card with Continue | Focus ring; shop-code error; bad credentials; box hides the code | Enter |
| `shell/` (45-852 nav) | Backdrop panel, top nav (Products, Import), shop switcher (Popover + Command), command palette, user menu (version from `buildInfo`, sign out), offline banner, Toaster | Offline | Mod+K palette; `/` search |
| `products/` | Toolbar (search, category), DataTable (name + SKU, category, unit, price, tax and online badges), new-product Sheet; infinite keyset, 100 per page | Skeleton, empty, no match, 403, error, offline | N new; Esc |
| `product/$id` | Details form, barcodes card, prices card (current, upcoming, history, branch overrides), price dialog, schedule dialog | No price yet, 404, field errors | Mod+S; P price |
| `import/` | Native file input and drop zone, dry-run report DataTable, run | Idle, checking, report, running, done, 413/400 | Mod+Enter |

Search state lives in `?q&categoryId`, validated by Valibot.

**Apps**
- `apps/portal`:
  - `vite.config.ts`: tailwind and React with the compiler. A proxy sends `/api` → `SHOPPER_API_URL ?? :8787`, stripping `/api` except for `/api/auth`, and keeps Origin.
  - `src/index.tsx`: root route with context, a `QueryClient`, and `createBackofficeRoutes`.
  - `src/styles.css`: imports the ui and backoffice styles.
- `apps/till-ui`: tailwind and styles, and renders `About` in a shadcn `Card` with a `Button`.
- Drop the broken `exports` from the portal and till-ui.
- `apps/edge`: port 8787 and `.dev.vars.example` (`SHOPPER_AUTH_URL=http://localhost:5173`).
- `apps/portal/README.md`: a sign-up curl line.

**E2E harness**
- Root `playwright.config.ts`:
  - projects `setup` → `portal`, plus `till-ui`
  - workers 1
  - `webServer` starts the box API (Bun) on :3101 against `shopper_e2e`, the portal on :5183 and till-ui on :5184
- `tooling/e2e-database.ts`: drop and recreate the database, migrate, and provision `e2e-mart` and `e2e-annex`.
- `tests/support/e2e.ts`: shared e2e helpers.
- Root script `e2e`, `.gitignore` for `tests/e2e/.auth/`, and a CI job (setup-bun, playwright chromium, `vp run e2e`).

## Rules at risk

- **Money:** price inputs are text with `inputMode=decimal` and go through `fromDecimal`. Display only through `<Money>`/`formatGHS`. No floats.
- **Tenancy:** the header only selects a tenant. The lookup returns id and name only, and the box answers only for its own org.
- **Audit:** no new mutations. `provisionOrg` stays a `defineCommand`.
- **Boundaries:**
  - backoffice imports only `@shopper/core/schemas`
  - ui never fetches
  - every `@shopper/*` import is declared in `package.json`
  - the portal `dist` is grepped for `drizzle|pg|xlsx`
- **Guard:**
  - no effects (loaders, `useSyncExternalStore`, ref callbacks)
  - `.tsx` ≤ 300 lines and `.ts` ≤ 250
  - Valibot only (Standard Schema in TanStack Form)
- **Design:** shadcn primitives plus tokens only, with no hex, px or arbitrary values in screens. One primary action per view. Icons have labels.

## Slices: agents, skills, commits

Every slice follows `tdd-slice`:
1. `test-author` writes the red tests.
2. `implementer` or `ui-builder` turns them green. UI slices load the `ui-screen` skill and use the shadcn MCP, Figma `get_design_context`/`get_screenshot` and Playwright MCP screenshots.
3. `checker` runs `vp check`, the guard and tests.
4. `reviewer` (the `pre-merge-review` skill, Codex `gpt-6.1-sol`) reviews, plus `ui-reviewer` for UI slices.
5. Fix the findings, run `superpowers:verification-before-completion`, then **commit**.

`explorer` handles lookups, and context7 covers TanStack, Tailwind v4 and the shadcn docs. Nothing is pushed until slice 7.

| # | Slice | Commit |
|---|---|---|
| 0 | Branch, save the plan into `docs/plans/` | `docs: day 6 plan` |
| 1 | Org lookup, view schemas, `field` errors, list price and order, seed slug; three integration files | `feat(api): shop code lookup, catalogue view schemas, field errors` |
| 2 | Toolchain, Tailwind v4, React Compiler, **shadcn init and components**, theme tokens, DataTable, Money, shortcuts, `useOnline`; till-ui on the kit; Playwright harness and CI; till smoke spec | `feat(ui): shadcn/ui kit on Tailwind v4 with Figma tokens` |
| 3 | Backoffice client, shop store, routes, login, shell, switcher, palette, proxy; `auth.setup` and `login.spec` | `feat(backoffice): portal shell, shop code login and switcher` |
| 4 | Products list and new-product sheet; `catalogue.spec` | `feat(backoffice): product list and create` |
| 5 | Product editor, barcodes, prices, schedule; `product.spec` | `feat(backoffice): product editor and pricing` |
| 6 | Import screen; `import.spec` (plus `silent-failure-hunter`) | `feat(backoffice): spreadsheet import with dry run` |
| 7 | Whole-branch `pre-merge-review` and a final `ui-reviewer` pass. Docs: developer-experience, testing and frontend. Full check run. **Push**, open the PR with screenshots, then bind the PR with the `ccd_pr` tools | `docs: day 6 rules and harness` |
| 8 | Notion Day 6 row: tick the tasks, add a "Day 6 complete" section (commits, test counts, PR link, remarks), set Status = Done | none |

**Remarks for the Notion section:**
- the `/api` prefix
- one session per origin
- prod hosting deferred to release
- box-mode e2e covered by integration tests
- Figma frames used as reference only
- dark theme derived, not designed

## Verification

- `vp run services:up && vp run db:migrate && vp run db:seed` against a reset dev DB, then sign up via the README curl.
- `vp test --run`: integration, conformance and guard tests.
- `vp run e2e`: all Playwright specs, including axe.
- `vp check`, `vp run guard`, `vp run build`, `vp run typecheck`.
- Manual run with `vp run dev`:
  - Sign in at :5173 with shop code `dev`.
  - Create a product, set a price, schedule a window, run a dry-run import of a messy XLSX, then the real import.
  - Toggle offline.
  - Take Playwright MCP screenshots at 1366, 1440 and 390, and compare them side by side with the Figma frames 9-61, 45-852 and 12-66.
- Smoke-test till-ui at :5174 to confirm it renders the shared Button and Card.

## Left out deliberately

- **Prod hosting** (edge static assets with `run_worker_first: /api/*`, and the box serving `dist`): release day.
- **Electron mount:** day 13.
- **Till sale screens:** days 8–10.
- **Category and supplier management screens, archive, and cancelling a scheduled price:** later.
- **From the Figma frames:** tabs with counts, the date filter and Export CSV, because there are no APIs for them yet.
- **Other deferrals:**
  - a 4-dp per-kg display
  - a theme toggle
  - a `/me` permissions endpoint
  - rate-limiting the slug lookup (RateLimiter DO)
  - a per-org session cookie
