import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { BillingSkeleton } from "../components/billing/states";
import { routeStates } from "../components/route/states";
import { billingQuery } from "../queries/billing";
import type { BackofficeContext } from "../types";
import { whenHeld } from "./held";

type Context = { context: BackofficeContext };

/** The subscription and its invoices, for members who manage billing. */
export function billingRoutes(shopRoute: AnyRoute) {
  const billingRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/billing",
    loader: ({ context }: Context) =>
      whenHeld(context, "billing.manage", () =>
        context.queryClient.ensureQueryData(billingQuery()),
      ),
    component: lazyRouteComponent(() => import("../screens/billing/screen"), "BillingScreen"),
    ...routeStates,
    pendingComponent: () => (
      <div className="flex flex-col gap-6">
        <div className="h-9" />
        <BillingSkeleton />
      </div>
    ),
  });
  return [billingRoute];
}
