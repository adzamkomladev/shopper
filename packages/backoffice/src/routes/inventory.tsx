import type * as v from "valibot";
import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { AdjustSkeleton, EntrySkeleton } from "../components/inventory/entry/states";
import { RecordSkeleton } from "../components/inventory/records/skeleton";
import { RecordsSkeleton } from "../components/inventory/records/states";
import { StockSkeleton } from "../components/inventory/stock/list/states";
import { StockProductSkeleton } from "../components/inventory/stock/product/states";
import { TakesSkeleton } from "../components/inventory/takes/list/states";
import { SheetSkeleton } from "../components/inventory/takes/sheet/states";
import { ValuationSkeleton } from "../components/inventory/valuation/states";
import { routeStates } from "../components/route/states";
import { SuppliersSkeleton } from "../components/suppliers/states";
import { pickBranch } from "../lib/inventory/format";
import type { PermissionCode } from "../lib/roles/permissions";
import { recordQuery, recordsListQuery } from "../queries/inventory/records";
import { stockBranchesQuery, stockListQuery, stockProductQuery } from "../queries/inventory/stock";
import { takeQuery, takesListQuery } from "../queries/inventory/takes";
import { valuationQuery } from "../queries/inventory/valuation";
import { permissionsQuery } from "../queries/session/permissions";
import { suppliersQuery } from "../queries/suppliers";
import { recordsSearch, stockProductSearch, stockSearch, takeSheetSearch } from "../schemas/routes";
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

/** Stock on hand, a product's movements and reorder level, stock records, receiving, adjusting, stock takes, valuation and suppliers. */
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
  const recordsRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/stock/records",
    validateSearch: recordsSearch,
    loaderDeps: ({ search }) => search,
    loader: ({ context, deps }: Context & { deps: v.InferOutput<typeof recordsSearch> }) =>
      whenHeld(context, "stock.read", async () => {
        const { branches } = await context.queryClient.ensureQueryData(stockBranchesQuery());
        const branch = pickBranch(branches, deps.branch);
        // Only started: the screen shows its own skeleton, so the heading and toolbar are there at once.
        if (branch)
          void context.queryClient.prefetchInfiniteQuery(
            recordsListQuery({ branchId: branch.id, kind: deps.kind }),
          );
      }),
    component: lazyRouteComponent(
      () => import("../screens/inventory/records/list/screen"),
      "RecordsScreen",
    ),
    ...routeStates,
    pendingComponent: RecordsSkeleton,
  });
  const recordRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/stock/records/$documentId",
    loader: ({ context, params }: Context & { params: { documentId: string } }) =>
      whenHeld(context, "stock.read", () =>
        context.queryClient.ensureQueryData(recordQuery(params.documentId)),
      ),
    component: lazyRouteComponent(
      () => import("../screens/inventory/records/detail/screen"),
      "RecordScreen",
    ),
    ...routeStates,
    pendingComponent: RecordSkeleton,
  });
  const entryLoader =
    (withSuppliers: boolean) =>
    ({ context }: Context) =>
      whenHeld(context, "stock.write", async () => {
        await Promise.all([
          context.queryClient.ensureQueryData(stockBranchesQuery()),
          withSuppliers &&
            whenHeld(context, "product.read", () =>
              context.queryClient.ensureQueryData(suppliersQuery()),
            ),
        ]);
      });
  const receiveRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/stock/receive",
    validateSearch: stockProductSearch,
    loader: entryLoader(true),
    component: lazyRouteComponent(
      () => import("../screens/inventory/receive/screen"),
      "ReceiveScreen",
    ),
    ...routeStates,
    pendingComponent: EntrySkeleton,
  });
  const adjustRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/stock/adjust",
    validateSearch: stockProductSearch,
    loader: entryLoader(false),
    component: lazyRouteComponent(
      () => import("../screens/inventory/adjust/screen"),
      "AdjustScreen",
    ),
    ...routeStates,
    pendingComponent: AdjustSkeleton,
  });
  const takesRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/stock/takes",
    validateSearch: stockProductSearch,
    loaderDeps: ({ search }) => search,
    loader: ({ context, deps }: Context & { deps: { branch?: string } }) =>
      whenHeld(context, "stock.read", async () => {
        const { branches } = await context.queryClient.ensureQueryData(stockBranchesQuery());
        const branch = pickBranch(branches, deps.branch);
        // Only started: the screen shows its own skeleton, so the heading and branch picker are there at once.
        if (branch) void context.queryClient.prefetchInfiniteQuery(takesListQuery(branch.id));
      }),
    component: lazyRouteComponent(
      () => import("../screens/inventory/takes/list/screen"),
      "TakesScreen",
    ),
    ...routeStates,
    pendingComponent: TakesSkeleton,
  });
  const takeRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/stock/takes/$takeId",
    validateSearch: takeSheetSearch,
    loader: ({ context, params }: Context & { params: { takeId: string } }) =>
      whenHeld(context, "stock.read", () =>
        context.queryClient.ensureQueryData(takeQuery(params.takeId)),
      ),
    component: lazyRouteComponent(
      () => import("../screens/inventory/takes/sheet/screen"),
      "TakeSheetScreen",
    ),
    ...routeStates,
    pendingComponent: SheetSkeleton,
  });
  const valuationRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/stock/valuation",
    validateSearch: stockProductSearch,
    loaderDeps: ({ search }) => search,
    loader: ({ context, deps }: Context & { deps: { branch?: string } }) =>
      whenHeld(context, "stock.read", async () => {
        const { branches } = await context.queryClient.ensureQueryData(stockBranchesQuery());
        const branch = pickBranch(branches, deps.branch);
        if (branch) void context.queryClient.prefetchQuery(valuationQuery(branch.id));
      }),
    component: lazyRouteComponent(
      () => import("../screens/inventory/valuation/screen"),
      "ValuationScreen",
    ),
    ...routeStates,
    pendingComponent: ValuationSkeleton,
  });
  return [
    stockRoute,
    productRoute,
    recordsRoute,
    recordRoute,
    receiveRoute,
    adjustRoute,
    takesRoute,
    takeRoute,
    valuationRoute,
    suppliersRoute,
  ];
}
