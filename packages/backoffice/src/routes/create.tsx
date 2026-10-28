import { shopSearch, catalogueSearch } from "../schemas/routes";
import { createRoute, lazyRouteComponent, redirect, type AnyRoute } from "@tanstack/react-router";

import { LoginSkeleton, routeStates, ShellSkeleton } from "../components/route/states";
import { ProductSkeleton } from "../components/catalogue/detail/states";
import { branchesQuery, productQuery } from "../queries/catalogue/detail";
import { ProductsSkeleton } from "../components/catalogue/list/states";
import { categoriesQuery, productsQuery, type ProductSearch } from "../queries/catalogue/list";
import { ListSkeleton } from "../components/admin/states";
import { mappingsQuery } from "../queries/catalogue/mappings";
import { permissionsQuery } from "../queries/session/permissions";
import { administrationRoutes } from "./administration";
import { publicAuthRoutes } from "./auth/public";
import { customerRoutes } from "./customers";
import { inventoryRoutes } from "./inventory";
import { kycRoutes } from "./kyc";
import { settingsRoutes } from "./settings";
import { reportRoutes } from "./reports";
import { taxRoutes } from "./tax";
import { auditRoutes } from "./audit";
import { transactionRoutes } from "./transactions";
import { paymentRoutes } from "./payments";
import { approvalRoutes } from "./approvals";
import { billingRoutes } from "./billing";
import { publicStatementRoutes } from "./statements/public";
import { shiftRoutes } from "./shifts";
import { setupRoutes } from "./setup";
import { setupQuery, startsInSetup } from "../queries/setup";
import { currentOrgQuery, requireSession } from "../queries/session/session";
import type { BackofficeContext } from "../types";

/**
 * Mounts login and the signed-in shell under the host's root route. `signIn` names a page outside this
 * router that signs people in instead (the register's own sign-in): /login then leaves for it.
 */
export function createBackofficeRoutes(
  rootRoute: AnyRoute,
  { signIn }: { signIn?: string } = {},
): AnyRoute {
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    // The front door: an owner still setting up the shop starts in the wizard, everyone else on the products.
    beforeLoad: async ({ context }: { context: BackofficeContext }) => {
      await requireSession(context.queryClient);
      const [progress, held] = await Promise.all([
        context.queryClient.fetchQuery(setupQuery()),
        context.queryClient.ensureQueryData(permissionsQuery()),
      ]);
      throw redirect({ to: startsInSetup(progress, held) ? "/setup" : "/products" });
    },
  });
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/login",
    validateSearch: shopSearch,
    beforeLoad: () => {
      if (signIn) throw redirect({ href: signIn, reloadDocument: true });
    },
    loader: ({ context }: { context: BackofficeContext }) =>
      context.queryClient.ensureQueryData(currentOrgQuery),
    component: lazyRouteComponent(() => import("../screens/auth/login/screen"), "LoginScreen"),
    ...routeStates,
    pendingComponent: LoginSkeleton,
  });
  const shopRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: "_shop",
    beforeLoad: ({ context }: { context: BackofficeContext }) =>
      requireSession(context.queryClient),
    component: lazyRouteComponent(() => import("../screens/shell/screen"), "ShellScreen"),
    ...routeStates,
    pendingComponent: ShellSkeleton,
  });
  const productsRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/products",
    validateSearch: catalogueSearch,
    loaderDeps: ({ search }) => search,
    loader: async ({ context, deps }: { context: BackofficeContext; deps: ProductSearch }) => {
      // Products are only started: the screen shows its own skeleton while they load, so the
      // heading and toolbar are there at once and a new search never replaces them.
      void context.queryClient.prefetchInfiniteQuery(productsQuery(deps));
      await context.queryClient.ensureQueryData(categoriesQuery());
    },
    component: lazyRouteComponent(
      () => import("../screens/catalogue/list/screen"),
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
      () => import("../screens/catalogue/detail/screen"),
      "ProductScreen",
    ),
    ...routeStates,
    pendingComponent: ProductSkeleton,
  });
  const mappingsRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/barcodes",
    loader: ({ context }: { context: BackofficeContext }) =>
      Promise.all([
        context.queryClient.ensureQueryData(mappingsQuery()),
        context.queryClient.ensureQueryData(permissionsQuery()),
      ]),
    component: lazyRouteComponent(
      () => import("../screens/catalogue/mappings/screen"),
      "MappingsScreen",
    ),
    ...routeStates,
    pendingComponent: () => <ListSkeleton label="Loading barcode layouts" />,
  });
  const importsRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/imports",
    component: lazyRouteComponent(
      () => import("../screens/catalogue/imports/screen"),
      "ImportsScreen",
    ),
    ...routeStates,
  });
  return rootRoute.addChildren([
    indexRoute,
    loginRoute,
    ...publicAuthRoutes(rootRoute),
    ...publicStatementRoutes(rootRoute),
    shopRoute.addChildren([
      productsRoute,
      productRoute,
      mappingsRoute,
      importsRoute,
      ...inventoryRoutes(shopRoute),
      ...customerRoutes(shopRoute),
      ...administrationRoutes(shopRoute),
      ...shiftRoutes(shopRoute),
      ...setupRoutes(shopRoute),
      ...kycRoutes(shopRoute),
      ...settingsRoutes(shopRoute),
      ...reportRoutes(shopRoute),
      ...taxRoutes(shopRoute),
      ...auditRoutes(shopRoute),
      ...transactionRoutes(shopRoute),
      ...paymentRoutes(shopRoute),
      ...approvalRoutes(shopRoute),
      ...billingRoutes(shopRoute),
    ]),
  ]);
}
