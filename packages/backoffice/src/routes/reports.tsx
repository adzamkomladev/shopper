import type * as v from "valibot";
import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { routeStates } from "../components/route/states";
import { ReportSkeleton } from "../components/reports/states";
import { rangeOf } from "../lib/reports/range";
import { shopToday } from "../lib/tax/dates";
import { reportQuery } from "../queries/reports/reports";
import type { ReportKind } from "../schemas/reports/views";
import { deadStockSearch, reportSearch, salesSearch } from "../schemas/reports/search";
import type { BackofficeContext } from "../types";
import { whenHeld } from "./held";

type Context = { context: BackofficeContext };
type Search = v.InferOutput<typeof reportSearch> & { by?: string; days?: number };

/** What each report reads, from its URL: the same parameters its screen asks the API for. */
const PARAMS: Record<ReportKind, (search: Search) => Record<string, string | undefined>> = {
  dashboard: (search) => ({ day: search.day ?? shopToday(), branchId: search.branchId }),
  sales: (search) => ({ ...rangeOf(search), by: search.by ?? "day", branchId: search.branchId }),
  products: (search) => ({ ...rangeOf(search), branchId: search.branchId }),
  branches: (search) => rangeOf(search),
  "stock/dead": (search) => ({
    on: search.day ?? shopToday(),
    days: `${search.days ?? 30}`,
    branchId: search.branchId,
  }),
  journal: (search) => ({ ...rangeOf(search), branchId: search.branchId }),
};

/** The reports area: the dashboard, sales, products and margin, dead stock, branches and the journal (report.read). */
export function reportRoutes(shopRoute: AnyRoute) {
  // Starts the report's request while the screen's code loads.
  const prefetch =
    (kind: ReportKind) =>
    ({ context, deps }: Context & { deps: Search }) =>
      whenHeld(context, "report.read", () => {
        void context.queryClient.prefetchQuery(reportQuery(kind, PARAMS[kind](deps)));
      });
  const dashboardRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/reports",
    validateSearch: reportSearch,
    loaderDeps: ({ search }) => search,
    loader: prefetch("dashboard"),
    component: lazyRouteComponent(
      () => import("../screens/reports/dashboard/screen"),
      "ReportsDashboardScreen",
    ),
    ...routeStates,
    pendingComponent: () => <ReportSkeleton label="Loading the dashboard" tiles />,
  });
  const salesRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/reports/sales",
    validateSearch: salesSearch,
    loaderDeps: ({ search }) => search,
    loader: prefetch("sales"),
    component: lazyRouteComponent(
      () => import("../screens/reports/sales/screen"),
      "SalesReportScreen",
    ),
    ...routeStates,
    pendingComponent: () => <ReportSkeleton label="Loading sales" />,
  });
  const productsRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/reports/products",
    validateSearch: reportSearch,
    loaderDeps: ({ search }) => search,
    loader: prefetch("products"),
    component: lazyRouteComponent(
      () => import("../screens/reports/products/screen"),
      "ProductsReportScreen",
    ),
    ...routeStates,
    pendingComponent: () => <ReportSkeleton label="Loading products" />,
  });
  const deadStockRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/reports/stock/dead",
    validateSearch: deadStockSearch,
    loaderDeps: ({ search }) => search,
    loader: prefetch("stock/dead"),
    component: lazyRouteComponent(
      () => import("../screens/reports/stock/screen"),
      "DeadStockScreen",
    ),
    ...routeStates,
    pendingComponent: () => <ReportSkeleton label="Loading dead stock" />,
  });
  const branchesRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/reports/branches",
    validateSearch: reportSearch,
    loaderDeps: ({ search }) => search,
    loader: prefetch("branches"),
    component: lazyRouteComponent(
      () => import("../screens/reports/branches/screen"),
      "BranchComparisonScreen",
    ),
    ...routeStates,
    pendingComponent: () => <ReportSkeleton label="Loading the branch comparison" />,
  });
  const journalRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/reports/journal",
    validateSearch: reportSearch,
    loaderDeps: ({ search }) => search,
    loader: prefetch("journal"),
    component: lazyRouteComponent(
      () => import("../screens/reports/journal/screen"),
      "JournalScreen",
    ),
    ...routeStates,
    pendingComponent: () => <ReportSkeleton label="Loading the journal" />,
  });
  return [dashboardRoute, salesRoute, productsRoute, deadStockRoute, branchesRoute, journalRoute];
}
