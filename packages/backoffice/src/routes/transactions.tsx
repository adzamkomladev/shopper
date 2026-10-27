import type * as v from "valibot";
import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { routeStates } from "../components/route/states";
import { TransactionError, TransactionSkeleton } from "../components/transactions/detail/states";
import { TransactionsSkeleton } from "../components/transactions/list/states";
import { transactionQuery } from "../queries/transactions/detail";
import { transactionsQuery } from "../queries/transactions/list";
import { transactionSearch } from "../schemas/transactions";
import type { BackofficeContext } from "../types";
import { whenHeld } from "./held";

type Context = { context: BackofficeContext };

/** The transactions explorer and a sale's drill-down; both need report.read. */
export function transactionRoutes(shopRoute: AnyRoute) {
  const listRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/transactions",
    validateSearch: transactionSearch,
    loaderDeps: ({ search }) => search,
    loader: ({ context, deps }: Context & { deps: v.InferOutput<typeof transactionSearch> }) =>
      // Started, not awaited: a new search suspends only the rows, so the filters keep focus.
      whenHeld(context, "report.read", () => {
        void context.queryClient.prefetchInfiniteQuery(transactionsQuery(deps));
      }),
    component: lazyRouteComponent(
      () => import("../screens/transactions/list/screen"),
      "TransactionsScreen",
    ),
    ...routeStates,
    pendingComponent: TransactionsSkeleton,
  });
  const detailRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/transactions/$saleId",
    loader: ({ context, params }: Context & { params: { saleId: string } }) =>
      context.queryClient.ensureQueryData(transactionQuery(params.saleId)),
    component: lazyRouteComponent(
      () => import("../screens/transactions/detail/screen"),
      "TransactionScreen",
    ),
    ...routeStates,
    errorComponent: TransactionError,
    pendingComponent: TransactionSkeleton,
  });
  return [listRoute, detailRoute];
}
