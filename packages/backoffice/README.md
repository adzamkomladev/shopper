# @shopper/backoffice

Shared back-office routes and screens for the web portal and Electron. The host owns the router,
root route and query client; mount the package with `createBackofficeRoutes(rootRoute)` and load
`@shopper/backoffice/styles.css`.

## Layout

- `src/screens/<context>/screen.tsx`: screen composition, including auth, catalogue and administration.
- `src/components/<context>/`: forms, tables, dialogs, states and shell parts.
- `src/queries/<context>.ts` and nested contexts: reads and mutations.
- `src/stores/`: remembered-shop subscription state.
- `src/hooks/<context>/`: UI orchestration and keyboard handling.
- `src/schemas/`: Valibot contracts and inferred types; contextual `types.ts` for reusable types.
- `src/routes/`: explicit route wiring; no required file-route names here.
- `src/api/` and `src/lib/`: API boundary and existing display/focus helpers.

Use nested contexts without hyphens in authored paths. Preserve public package subpaths and URLs through explicit compatibility mappings. Hosts mount the same exported API; provider credentials and Node APIs never enter these components.

## Register sections (Day 13)

`createBackofficeRoutes(rootRoute, { signIn })` takes an optional page outside the router that signs
people in; `/login` leaves for it. The register's own back office (`apps/till/ui/backoffice/`, served by the
till host at `/backoffice/`) passes `signIn: "/"`, because staff sign in on the register.

`@shopper/backoffice/register` exports the three tabs of the desktop shell as plain components, not
routes, because the shell is a tab strip and owns the heading and the permission-gated tab list:
`RegisterDashboard`, `RegisterReports` and `RegisterInventory` (stock count, receiving and the queue), inside one
`RegisterProvider` (its own query cache, remounted per signed-in user). They call only the host's
same-origin `/api/register/*` and `/api/session/permissions`, so they work offline. What renders follows the
permission codes (`report.read`, `stock.read`, `stock.write`), never a role name.

From the repository root, run `vp run @shopper/backoffice#build` to type-check the package.
Portal browser flows live in `tests/e2e/portal/` and run through `vp run e2e`.
