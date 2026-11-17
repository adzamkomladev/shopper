import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { routeStates } from "../components/route/states";

/**
 * Move to cloud (on a box) and Move on-prem (in the cloud), for members who hold migration.run (the screens' own gate
 * says so to the rest).
 */
export function migrationRoutes(shopRoute: AnyRoute) {
  const moveRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/migration/move",
    component: lazyRouteComponent(() => import("../screens/migration/move/screen"), "MoveScreen"),
    ...routeStates,
  });
  const onPremRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/migration/onprem",
    component: lazyRouteComponent(
      () => import("../screens/migration/onprem/screen"),
      "OnPremScreen",
    ),
    ...routeStates,
  });
  return [moveRoute, onPremRoute];
}
