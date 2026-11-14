import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { routeStates } from "../components/route/states";

/** Move to cloud, on a box, for members who hold migration.run (the screen's own gate says so to the rest). */
export function migrationRoutes(shopRoute: AnyRoute) {
  const moveRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/migration/move",
    component: lazyRouteComponent(() => import("../screens/migration/move/screen"), "MoveScreen"),
    ...routeStates,
  });
  return [moveRoute];
}
