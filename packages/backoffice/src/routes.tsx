import { createRoute, lazyRouteComponent, redirect, type AnyRoute } from "@tanstack/react-router";
import * as v from "valibot";
import { LoginSkeleton, routeStates, ShellSkeleton } from "./components/route-states";
import { ProductSkeleton } from "./screens/catalogue/detail/states";
import { branchesQuery, productQuery } from "./screens/catalogue/detail/queries";
import { ProductsSkeleton } from "./screens/catalogue/list/states";
import {
  categoriesQuery,
  productsQuery,
  type ProductSearch,
} from "./screens/catalogue/list/queries";
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
    component: lazyRouteComponent(() => import("./screens/auth/login/screen"), "LoginScreen"),
    ...routeStates,
    pendingComponent: LoginSkeleton,
  });
  const shopRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: "_shop",
    beforeLoad: ({ context }: { context: BackofficeContext }) =>
      requireSession(context.queryClient),
    component: lazyRouteComponent(() => import("./layouts/shell/screen"), "ShellScreen"),
    ...routeStates,
    pendingComponent: ShellSkeleton,
  });
  const productsRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/products",
    validateSearch: v.object({ q: v.optional(v.string()), categoryId: v.optional(v.string()) }),
    loaderDeps: ({ search }) => search,
    loader: async ({ context, deps }: { context: BackofficeContext; deps: ProductSearch }) => {
      // Products are only started: the screen shows its own skeleton while they load, so the
      // heading and toolbar are there at once and a new search never replaces them.
      void context.queryClient.prefetchInfiniteQuery(productsQuery(deps));
      await context.queryClient.ensureQueryData(categoriesQuery());
    },
    component: lazyRouteComponent(
      () => import("./screens/catalogue/list/screen"),
      "ProductsScreen",
    ),
    ...routeStates,
    pendingComponent: ProductsSkeleton,
  });
  const productRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/products/$productId",
    loader: async ({
      context,
      params,
    }: {
      context: BackofficeContext;
      params: { productId: string };
    }) => {
      // Branch names only label prices, and a role without branch.read must still see the page.
      void context.queryClient.prefetchQuery(branchesQuery());
      await Promise.all([
        context.queryClient.ensureQueryData(productQuery(params.productId)),
        context.queryClient.ensureQueryData(categoriesQuery()),
      ]);
    },
    component: lazyRouteComponent(
      () => import("./screens/catalogue/detail/screen"),
      "ProductScreen",
    ),
    ...routeStates,
    pendingComponent: ProductSkeleton,
  });
  const importsRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/imports",
    component: lazyRouteComponent(
      () => import("./screens/catalogue/imports/screen"),
      "ImportsScreen",
    ),
    ...routeStates,
  });
  return rootRoute.addChildren([
    indexRoute,
    loginRoute,
    shopRoute.addChildren([productsRoute, productRoute, importsRoute]),
  ]);
}
