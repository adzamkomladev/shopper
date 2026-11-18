import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { routeStates } from "../components/route/states";
import { LoyaltySkeleton, OnlineSkeleton, SettingsSkeleton } from "../components/settings/states";
import { categoriesQuery } from "../queries/catalogue/list";
import { onlineSettingsQuery } from "../queries/settings/online";
import { settingsQuery } from "../queries/settings/resource";
import { tiersQuery } from "../queries/settings/tiers";
import type { BackofficeContext } from "../types";

type Context = { context: BackofficeContext };

/** The org's customer settings (loyalty and its tiers, credit terms, statements, identity checks; `customer.manage`) and the online store (`product.read`). */
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
    pendingComponent: () => <LoyaltySkeleton />,
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
    pendingComponent: () => <SettingsSkeleton page="credit" />,
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
    pendingComponent: () => <SettingsSkeleton page="kyc" />,
  });
  const statementsRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/settings/statements",
    loader: ({ context }: Context) =>
      context.queryClient.ensureQueryData(settingsQuery("statements")),
    component: lazyRouteComponent(
      () => import("../screens/settings/statements/screen"),
      "StatementsSettingsScreen",
    ),
    ...routeStates,
    pendingComponent: () => <SettingsSkeleton page="statements" />,
  });
  const onlineRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/settings/online",
    loader: ({ context }: Context) =>
      Promise.all([
        context.queryClient.ensureQueryData(onlineSettingsQuery()),
        context.queryClient.ensureQueryData(categoriesQuery()),
      ]),
    component: lazyRouteComponent(
      () => import("../screens/settings/online/screen"),
      "OnlineSettingsScreen",
    ),
    ...routeStates,
    pendingComponent: () => <OnlineSkeleton />,
  });
  return [loyaltyRoute, creditRoute, statementsRoute, kycRoute, onlineRoute];
}
