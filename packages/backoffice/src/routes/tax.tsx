import type * as v from "valibot";
import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { routeStates } from "../components/route/states";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { TaxPage } from "../components/tax/tabs";
import {
  RatesSkeleton,
  ReturnSkeleton,
  RulesActionSkeleton,
  SummarySkeleton,
  TaxSettingsSkeleton,
} from "../components/tax/states";
import { lastMonth, shopToday } from "../lib/tax/dates";
import { settingsQuery } from "../queries/settings/resource";
import { taxRulesQuery } from "../queries/tax/rules";
import { taxSummaryQuery, vatReturnQuery } from "../queries/tax/returns";
import { returnSearch, summarySearch } from "../schemas/tax/returns";
import { fiscalSearch } from "../schemas/tax/fiscal";
import { fiscalArchivesQuery, fiscalListQuery } from "../queries/tax/fiscal";
import { FiscalSkeleton } from "../components/tax/fiscal/states";
import type { BackofficeContext } from "../types";
import { whenHeld } from "./held";

type Context = { context: BackofficeContext };

/** The tax area: the summary, the monthly VAT return, fiscal documents, the dated rates and the tax settings. Each needs tax.read. */
export function taxRoutes(shopRoute: AnyRoute) {
  const summaryRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/tax",
    validateSearch: summarySearch,
    loaderDeps: ({ search }) => search,
    loader: ({ context, deps }: Context & { deps: v.InferOutput<typeof summarySearch> }) =>
      whenHeld(context, "tax.read", () => {
        const today = shopToday();
        void context.queryClient.prefetchQuery(
          taxSummaryQuery({
            from: deps.from ?? `${today.slice(0, 7)}-01`,
            to: deps.to ?? today,
            group: deps.group ?? "day",
          }),
        );
      }),
    component: lazyRouteComponent(
      () => import("../screens/tax/summary/screen"),
      "TaxSummaryScreen",
    ),
    ...routeStates,
    pendingComponent: () => (
      <TaxPage active="summary">
        <SummarySkeleton />
      </TaxPage>
    ),
  });
  const returnsRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/tax/returns",
    validateSearch: returnSearch,
    loaderDeps: ({ search }) => search,
    loader: ({ context, deps }: Context & { deps: v.InferOutput<typeof returnSearch> }) =>
      whenHeld(context, "tax.read", () => {
        void context.queryClient.prefetchQuery(
          vatReturnQuery(deps.period ?? lastMonth(shopToday())),
        );
      }),
    component: lazyRouteComponent(() => import("../screens/tax/returns/screen"), "VatReturnScreen"),
    ...routeStates,
    pendingComponent: () => (
      <TaxPage active="returns" action={<Skeleton className="h-8 w-36.25" />}>
        <ReturnSkeleton />
      </TaxPage>
    ),
  });
  const fiscalRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/tax/fiscal",
    validateSearch: fiscalSearch,
    loaderDeps: ({ search }) => search,
    loader: ({ context, deps }: Context & { deps: v.InferOutput<typeof fiscalSearch> }) =>
      whenHeld(context, "tax.read", () =>
        Promise.all([
          context.queryClient.ensureQueryData(fiscalListQuery(deps)),
          context.queryClient.ensureQueryData(fiscalArchivesQuery(deps.date ?? shopToday())),
        ]),
      ),
    component: lazyRouteComponent(() => import("../screens/tax/fiscal/screen"), "FiscalScreen"),
    ...routeStates,
    pendingComponent: () => (
      <TaxPage active="fiscal">
        <FiscalSkeleton />
      </TaxPage>
    ),
  });
  const rulesRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/tax/rules",
    loader: ({ context }: Context) =>
      whenHeld(context, "tax.read", () => context.queryClient.ensureQueryData(taxRulesQuery())),
    component: lazyRouteComponent(() => import("../screens/tax/rules/screen"), "TaxRulesScreen"),
    ...routeStates,
    pendingComponent: () => (
      <TaxPage active="rules" action={<RulesActionSkeleton />}>
        <RatesSkeleton />
      </TaxPage>
    ),
  });
  const settingsRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/tax/settings",
    loader: ({ context }: Context) =>
      whenHeld(context, "tax.read", () =>
        context.queryClient.ensureQueryData(settingsQuery("tax")),
      ),
    component: lazyRouteComponent(
      () => import("../screens/tax/settings/screen"),
      "TaxSettingsScreen",
    ),
    ...routeStates,
    pendingComponent: () => (
      <TaxPage active="settings">
        <TaxSettingsSkeleton />
      </TaxPage>
    ),
  });
  return [summaryRoute, returnsRoute, fiscalRoute, rulesRoute, settingsRoute];
}
