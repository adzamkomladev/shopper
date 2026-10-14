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

From the repository root, run `vp run @shopper/backoffice#build` to type-check the package.
Portal browser flows live in `tests/e2e/portal/` and run through `vp run e2e`.
