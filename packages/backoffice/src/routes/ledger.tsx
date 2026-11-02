import type * as v from "valibot";
import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { routeStates } from "../components/route/states";
import { ChartSkeleton, RangeSkeleton } from "../components/ledger/states";
import { LedgerPage } from "../components/ledger/tabs";
import { ledgerRange } from "../lib/ledger/range";
import {
  accountLinesQuery,
  balanceQuery,
  chartQuery,
  journalQuery,
  profitQuery,
  trialQuery,
} from "../queries/ledger/books";
import { ledgerSearch } from "../schemas/ledger/views";
import type { BackofficeContext } from "../types";
import { whenHeld } from "./held";

type Loader = { context: BackofficeContext; deps: v.InferOutput<typeof ledgerSearch> };

/** The books (ledger.read): the chart of accounts, one account's lines, the journal and the statements. */
export function ledgerRoutes(shopRoute: AnyRoute) {
  const accountsRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/ledger",
    loader: ({ context }: { context: BackofficeContext }) =>
      whenHeld(context, "ledger.read", () => void context.queryClient.prefetchQuery(chartQuery())),
    component: lazyRouteComponent(
      () => import("../screens/ledger/accounts/screen"),
      "LedgerAccountsScreen",
    ),
    ...routeStates,
    pendingComponent: () => (
      <LedgerPage active="accounts">
        <ChartSkeleton />
      </LedgerPage>
    ),
  });
  const accountRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/ledger/accounts/$id",
    validateSearch: ledgerSearch,
    loaderDeps: ({ search }) => search,
    loader: ({ context, deps, params }: Loader & { params: { id: string } }) =>
      whenHeld(context, "ledger.read", () => {
        const range = ledgerRange(deps);
        void context.queryClient.prefetchQuery(accountLinesQuery(params.id, range.from, range.to));
      }),
    component: lazyRouteComponent(
      () => import("../screens/ledger/account/screen"),
      "LedgerAccountScreen",
    ),
    ...routeStates,
    pendingComponent: () => <RangeSkeleton label="Loading the account" />,
  });
  const journalRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/ledger/journal",
    validateSearch: ledgerSearch,
    loaderDeps: ({ search }) => search,
    loader: ({ context, deps }: Loader) =>
      whenHeld(context, "ledger.read", () => {
        const range = ledgerRange(deps);
        void context.queryClient.prefetchQuery(journalQuery(range.from, range.to));
      }),
    component: lazyRouteComponent(
      () => import("../screens/ledger/journal/screen"),
      "LedgerJournalScreen",
    ),
    ...routeStates,
    pendingComponent: () => (
      <LedgerPage active="journal">
        <RangeSkeleton label="Loading the journal" />
      </LedgerPage>
    ),
  });
  const statementsRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/ledger/statements",
    validateSearch: ledgerSearch,
    loaderDeps: ({ search }) => search,
    loader: ({ context, deps }: Loader) =>
      whenHeld(context, "ledger.read", () => {
        const range = ledgerRange(deps);
        const statement = deps.statement ?? "trial";
        const client = context.queryClient;
        if (statement === "trial") void client.prefetchQuery(trialQuery(range.to));
        if (statement === "profit") void client.prefetchQuery(profitQuery(range.from, range.to));
        if (statement === "balance") void client.prefetchQuery(balanceQuery(range.to));
      }),
    component: lazyRouteComponent(
      () => import("../screens/ledger/statements/screen"),
      "LedgerStatementsScreen",
    ),
    ...routeStates,
    pendingComponent: () => (
      <LedgerPage active="statements">
        <RangeSkeleton label="Loading the statement" />
      </LedgerPage>
    ),
  });
  return [accountsRoute, accountRoute, journalRoute, statementsRoute];
}
