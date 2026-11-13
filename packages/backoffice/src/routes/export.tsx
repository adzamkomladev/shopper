import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { routeStates } from "../components/route/states";

/** Data export, for members who hold export.run (the screen's own gate says so to the rest). */
export function exportRoutes(shopRoute: AnyRoute) {
  const exportRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/export",
    component: lazyRouteComponent(() => import("../screens/export/screen"), "ExportScreen"),
    ...routeStates,
  });
  return [exportRoute];
}
