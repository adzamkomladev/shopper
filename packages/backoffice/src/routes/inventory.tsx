import type * as v from "valibot";
import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { StockSkeleton } from "../components/inventory/stock/list/states";
import { StockProductSkeleton } from "../components/inventory/stock/product/states";
import { routeStates } from "../components/route/states";
import { SuppliersSkeleton } from "../components/suppliers/states";
import { pickBranch } from "../lib/inventory/format";
import type { PermissionCode } from "../lib/roles/permissions";
import { stockBranchesQuery, stockListQuery, stockProductQuery } from "../queries/inventory/stock";
import { permissionsQuery } from "../queries/session/permissions";
import { suppliersQuery } from "../queries/suppliers";
import { stockProductSearch, stockSearch } from "../schemas/routes";
import type { BackofficeContext } from "../types";

type Context = { context: BackofficeContext };

// A member without the permission is shown the no-permission state by the screen, so nothing is fetched for them.
async function whenHeld(
  { queryClient }: BackofficeContext,
  code: PermissionCode,
  load: () => unknown,
) {
  if ((await queryClient.ensureQueryData(permissionsQuery())).includes(code)) await load();
}

/** Stock on hand, a product's movements and reorder level, and suppliers. */
export function inventoryRoutes(shopRoute: AnyRoute) {
  const stockRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/stock",
    validateSearch: stockSearch,
    loaderDeps: ({ search }) => search,
    loader: ({ context, deps }: Context & { deps: v.InferOutput<typeof stockSearch> }) =>
      whenHeld(context, "stock.read", async () => {
        const { branches } = await context.queryClient.ensureQueryData(stockBranchesQuery());
        const branch = pickBranch(branches, deps.branch);
        // Only started: the screen shows its own skeleton, so the heading and toolbar are there at once.
        if (branch)
          void context.queryClient.prefetchInfiniteQuery(
            stockListQuery({ branchId: branch.id, q: deps.q, low: deps.low }),
          );
      }),
    component: lazyRouteComponent(
      () => import("../screens/inventory/stock/list/screen"),
      "StockScreen",
    ),
    ...routeStates,
    pendingComponent: StockSkeleton,
  });
  const productRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/stock/products/$productId",
    validateSearch: stockProductSearch,
    loaderDeps: ({ search }) => search,
    loader: ({
      context,
      deps,
      params,
    }: Context & { deps: { branch?: string }; params: { productId: string } }) =>
      whenHeld(context, "stock.read", async () => {
        const { branches } = await context.queryClient.ensureQueryData(stockBranchesQuery());
        const branch = pickBranch(branches, deps.branch);
        if (branch)
          await context.queryClient.ensureQueryData(stockProductQuery(params.productId, branch.id));
      }),
    component: lazyRouteComponent(
      () => import("../screens/inventory/stock/product/screen"),
      "StockProductScreen",
    ),
    ...routeStates,
    pendingComponent: StockProductSkeleton,
  });
  const suppliersRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/suppliers",
    loader: ({ context }: Context) =>
      whenHeld(context, "product.read", () =>
        context.queryClient.ensureQueryData(suppliersQuery()),
      ),
    component: lazyRouteComponent(() => import("../screens/suppliers/screen"), "SuppliersScreen"),
    ...routeStates,
    pendingComponent: SuppliersSkeleton,
  });
  return [stockRoute, productRoute, suppliersRoute];
}
