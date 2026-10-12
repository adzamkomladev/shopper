# @shopper/backoffice

Shared back-office routes and screens for the web portal and Electron. The host owns the router,
root route and query client; mount the package with `createBackofficeRoutes(rootRoute)` and load
`@shopper/backoffice/styles.css`.

## Layout

- `src/screens/auth/login/`: sign-in screen, form, success state and queries.
- `src/screens/catalogue/list/`: catalogue browsing; `create/` holds the new-product form and sheet.
- `src/screens/catalogue/detail/`: product details; `prices/` holds price cards, dialogs, rows and grouping.
- `src/screens/catalogue/imports/`: file selection, preview report and completion.
- `src/layouts/shell/`: signed-in layout, navigation and shop switching.
- `src/schemas/`: Valibot login, catalogue and product form schemas and their inferred types.
- `src/components/fields/`: shared text and select form fields.
- `src/session/`, `src/shops/`, `src/api/`: session queries, remembered-shop store and API client.

Folders supply the domain name: use `auth/login/form.tsx`, `catalogue/list/create/sheet.tsx` and
`catalogue/detail/prices/row.tsx`. Do not repeat that domain as a file prefix or suffix. Exported components
keep descriptive names, and hooks retain `use-` (for example `catalogue/list/use-search.ts`).

From the repository root, run `vp run @shopper/backoffice#build` to type-check the package.
Portal browser flows live in `tests/e2e/portal/` and run through `vp run e2e`.
