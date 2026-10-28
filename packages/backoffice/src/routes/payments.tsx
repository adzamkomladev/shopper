import type * as v from "valibot";
import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { routeStates } from "../components/route/states";
import { PaymentSettingsSkeleton } from "../components/payments/settings/states";
import { ReconciliationSkeleton } from "../components/payments/reconciliation/states";
import { shopToday } from "../lib/tax/dates";
import { reconciliationQuery } from "../queries/payments/reconciliation";
import { KybSkeleton } from "../components/kyb/states";
import { kybBanksQuery, kybQuery } from "../queries/kyb";
import { paymentSettingsQuery } from "../queries/payments/settings";
import { reconciliationSearch } from "../schemas/reconciliation";
import type { BackofficeContext } from "../types";
import { whenHeld } from "./held";

type Context = { context: BackofficeContext };

/**
 * A day's tender reconciliation (report.read; refreshing the settlement needs payment.reconcile), the org's MoMo
 * provider (register.settings) and the business verification that turns on payouts (org.kyb.submit).
 */
export function paymentRoutes(shopRoute: AnyRoute) {
  const reconciliationRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/payments/reconciliation",
    validateSearch: reconciliationSearch,
    loaderDeps: ({ search }) => search,
    loader: ({ context, deps }: Context & { deps: v.InferOutput<typeof reconciliationSearch> }) =>
      // Started, not awaited: a new day suspends only the figures, so the header and its focus stay put.
      whenHeld(context, "report.read", () => {
        void context.queryClient.prefetchQuery(reconciliationQuery(deps.day ?? shopToday()));
      }),
    component: lazyRouteComponent(
      () => import("../screens/payments/reconciliation/screen"),
      "ReconciliationScreen",
    ),
    ...routeStates,
    pendingComponent: ReconciliationSkeleton,
  });
  const settingsRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/payments/settings",
    loader: ({ context }: Context) =>
      whenHeld(context, "register.settings", () =>
        context.queryClient.ensureQueryData(paymentSettingsQuery()),
      ),
    component: lazyRouteComponent(
      () => import("../screens/payments/settings/screen"),
      "PaymentSettingsScreen",
    ),
    ...routeStates,
    pendingComponent: PaymentSettingsSkeleton,
  });
  const verificationRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/payments/verification",
    // Prefetched, not awaited: on the box the case answers 404 and the screen explains it.
    loader: ({ context }: Context) =>
      whenHeld(context, "org.kyb.submit", () => {
        void context.queryClient.prefetchQuery(kybQuery());
        void context.queryClient.prefetchQuery(kybBanksQuery());
      }),
    component: lazyRouteComponent(() => import("../screens/kyb/screen"), "KybScreen"),
    ...routeStates,
    pendingComponent: KybSkeleton,
  });
  return [reconciliationRoute, settingsRoute, verificationRoute];
}
