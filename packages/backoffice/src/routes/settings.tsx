import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { routeStates } from "../components/route/states";
import { SettingsSkeleton } from "../components/settings/states";
import { settingsQuery } from "../queries/settings/resource";
import { tiersQuery } from "../queries/settings/tiers";
import type { BackofficeContext } from "../types";

type Context = { context: BackofficeContext };

/** The org's customer settings: loyalty and its tiers, credit terms, and identity checks. Each needs `customer.manage`. */
export function settingsRoutes(shopRoute: AnyRoute) {
  const loyaltyRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/settings/loyalty",
    loader: ({ context }: Context) =>
      Promise.all([
        context.queryClient.ensureQueryData(settingsQuery("loyalty")),
        context.queryClient.ensureQueryData(tiersQuery()),
      ]),
    component: lazyRouteComponent(
      () => import("../screens/settings/loyalty/screen"),
      "LoyaltySettingsScreen",
    ),
    ...routeStates,
    pendingComponent: () => <SettingsSkeleton label="Loading loyalty settings" fields={4} />,
  });
  const creditRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/settings/credit",
    loader: ({ context }: Context) => context.queryClient.ensureQueryData(settingsQuery("credit")),
    component: lazyRouteComponent(
      () => import("../screens/settings/credit/screen"),
      "CreditSettingsScreen",
    ),
    ...routeStates,
    pendingComponent: () => <SettingsSkeleton label="Loading credit settings" fields={2} />,
  });
  const kycRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/settings/kyc",
    loader: ({ context }: Context) => context.queryClient.ensureQueryData(settingsQuery("kyc")),
    component: lazyRouteComponent(
      () => import("../screens/settings/kyc/screen"),
      "KycSettingsScreen",
    ),
    ...routeStates,
    pendingComponent: () => <SettingsSkeleton label="Loading identity check settings" fields={2} />,
  });
  return [loyaltyRoute, creditRoute, kycRoute];
}
