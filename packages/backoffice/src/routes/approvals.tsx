import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { ApprovalsSkeleton } from "../components/approvals/states";
import { routeStates } from "../components/route/states";
import { pendingApprovalsQuery } from "../queries/approvals/inbox";
import type { BackofficeContext } from "../types";
import { whenHeld } from "./held";

type Context = { context: BackofficeContext };

/** The approvals inbox, for members who may approve refunds or discounts. */
export function approvalRoutes(shopRoute: AnyRoute) {
  const inboxRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/approvals",
    loader: ({ context }: Context) =>
      whenHeld(context, ["refund.approve", "sale.discount"], () =>
        context.queryClient.ensureQueryData(pendingApprovalsQuery()),
      ),
    component: lazyRouteComponent(() => import("../screens/approvals/screen"), "ApprovalsScreen"),
    ...routeStates,
    pendingComponent: () => (
      <div className="flex flex-col gap-6">
        <div className="h-14" />
        <ApprovalsSkeleton />
      </div>
    ),
  });
  return [inboxRoute];
}
