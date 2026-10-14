# Back office schemas by business context

Schema folders describe their business context rather than the component, query or store that uses them. These moves preserve exported symbols and validation behavior. Login input and response contracts remain distinct.

| Before                                                             | After                                                    |
| ------------------------------------------------------------------ | -------------------------------------------------------- |
| `packages/backoffice/src/schemas/queries/branches.ts`              | `packages/backoffice/src/schemas/branches.ts`            |
| `packages/backoffice/src/schemas/queries/stores.ts`                | `packages/backoffice/src/schemas/stores.ts`              |
| `packages/backoffice/src/schemas/queries/users.ts`                 | `packages/backoffice/src/schemas/users.ts`               |
| `packages/backoffice/src/schemas/queries/devices.ts`               | `packages/backoffice/src/schemas/devices.ts`             |
| `packages/backoffice/src/schemas/queries/catalogue/list.ts`        | `packages/backoffice/src/schemas/catalogue/list.ts`      |
| `packages/backoffice/src/schemas/queries/catalogue/detail.ts`      | `packages/backoffice/src/schemas/catalogue/detail.ts`    |
| `packages/backoffice/src/schemas/components/roles/form.ts`         | `packages/backoffice/src/schemas/roles/form.ts`          |
| `packages/backoffice/src/schemas/components/devices/enrol/form.ts` | `packages/backoffice/src/schemas/devices/enrol/form.ts`  |
| `packages/backoffice/src/schemas/components/devices/pin/form.ts`   | `packages/backoffice/src/schemas/devices/pin/form.ts`    |
| `packages/backoffice/src/schemas/components/users/invite/form.ts`  | `packages/backoffice/src/schemas/users/invite/form.ts`   |
| `packages/backoffice/src/schemas/queries/session/session.ts`       | `packages/backoffice/src/schemas/session.ts`             |
| `packages/backoffice/src/schemas/routes/auth/public.ts`            | `packages/backoffice/src/schemas/auth/public.ts`         |
| `packages/backoffice/src/schemas/routes/create.ts`                 | `packages/backoffice/src/schemas/routes.ts`              |
| `packages/backoffice/src/schemas/stores/shops.ts`                  | `packages/backoffice/src/schemas/shops.ts`               |
| `packages/backoffice/src/schemas/login.ts`                         | `packages/backoffice/src/schemas/auth/login/input.ts`    |
| `packages/backoffice/src/schemas/queries/auth/login.ts`            | `packages/backoffice/src/schemas/auth/login/response.ts` |
| `packages/backoffice/src/schemas/queries/auth/signup.ts`           | `packages/backoffice/src/schemas/auth/signup.ts`         |
| `packages/backoffice/src/schemas/onboarding.ts`                    | `packages/backoffice/src/schemas/auth/onboarding.ts`     |
