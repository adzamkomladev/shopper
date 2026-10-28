import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { routeStates } from "../components/route/states";
import { SetupSkeleton } from "../components/setup/states";
import { branchesQuery } from "../queries/catalogue/detail";
import { permissionsQuery } from "../queries/session/permissions";
import { rolesQuery } from "../queries/roles";
import { settingsQuery } from "../queries/settings/resource";
import { setupQuery } from "../queries/setup";
import { storesQuery } from "../queries/stores";
import { setupSearch } from "../schemas/setup";
import type { BackofficeContext } from "../types";
import { whenHeld } from "./held";

type Context = { context: BackofficeContext };

/** The setup wizard. Each step's own data loads up front, so moving between steps never waits. */
export function setupRoutes(shopRoute: AnyRoute) {
  const route = createRoute({
    getParentRoute: () => shopRoute,
    path: "/setup",
    validateSearch: setupSearch,
    loader: async ({ context }: Context) => {
      await Promise.all([
        context.queryClient.fetchQuery(setupQuery()),
        context.queryClient.ensureQueryData(permissionsQuery()),
      ]);
      // Each step's data, for the members whose role reads it; a step whose data is missing shows read-only.
      await Promise.all([
        whenHeld(context, "store.read", () => context.queryClient.ensureQueryData(storesQuery())),
        whenHeld(context, "branch.read", () =>
          context.queryClient.ensureQueryData(branchesQuery()),
        ),
        whenHeld(context, "role.read", () => context.queryClient.ensureQueryData(rolesQuery())),
        whenHeld(context, "tax.read", () =>
          context.queryClient.ensureQueryData(settingsQuery("tax")),
        ),
      ]);
    },
    component: lazyRouteComponent(() => import("../screens/setup/screen"), "SetupScreen"),
    ...routeStates,
    pendingComponent: SetupSkeleton,
  });
  return [route];
}
