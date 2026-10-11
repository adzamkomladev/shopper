import { createRoute, lazyRouteComponent, redirect, type AnyRoute } from "@tanstack/react-router";
import * as v from "valibot";
import { LoginSkeleton, routeStates, ShellSkeleton } from "./components/route-states";
import { currentOrgQuery, requireSession } from "./session/queries";
import type { BackofficeContext } from "./types";

/** Mounts login and the signed-in shell under the host's root route. */
export function createBackofficeRoutes(rootRoute: AnyRoute): AnyRoute {
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    beforeLoad: () => {
      throw redirect({ to: "/products" });
    },
  });
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/login",
    validateSearch: v.object({ shop: v.optional(v.string()) }),
    loader: ({ context }: { context: BackofficeContext }) =>
      context.queryClient.ensureQueryData(currentOrgQuery),
    component: lazyRouteComponent(() => import("./screens/login/login-screen"), "LoginScreen"),
    ...routeStates,
    pendingComponent: LoginSkeleton,
  });
  const shopRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: "_shop",
    beforeLoad: ({ context }: { context: BackofficeContext }) =>
      requireSession(context.queryClient),
    component: lazyRouteComponent(() => import("./screens/shell/shell-screen"), "ShellScreen"),
    ...routeStates,
    pendingComponent: ShellSkeleton,
  });
  const productsRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/products",
    component: lazyRouteComponent(
      () => import("./screens/products/products-screen"),
      "ProductsScreen",
    ),
    ...routeStates,
  });
  const importsRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/imports",
    component: lazyRouteComponent(
      () => import("./screens/imports/imports-screen"),
      "ImportsScreen",
    ),
    ...routeStates,
  });
  return rootRoute.addChildren([
    indexRoute,
    loginRoute,
    shopRoute.addChildren([productsRoute, importsRoute]),
  ]);
}
