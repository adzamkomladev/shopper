import type * as v from "valibot";
import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { PickSkeleton } from "../components/orders/pick/states";
import { OrdersSkeleton } from "../components/orders/queue/states";
import { routeStates } from "../components/route/states";
import { staffOrderQuery } from "../queries/orders/order";
import { orderQueueQuery } from "../queries/orders/queue";
import { orderSearch } from "../schemas/orders";
import type { BackofficeContext } from "../types";
import { whenHeld } from "./held";

type Context = { context: BackofficeContext };

/** The online order queue and one order's pick list; both need order.read (changes need order.fulfil). */
export function orderRoutes(shopRoute: AnyRoute) {
  const queueRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/orders",
    validateSearch: orderSearch,
    loaderDeps: ({ search }) => search,
    loader: ({ context, deps }: Context & { deps: v.InferOutput<typeof orderSearch> }) =>
      whenHeld(context, "order.read", () => {
        void context.queryClient.prefetchQuery(orderQueueQuery(deps));
      }),
    component: lazyRouteComponent(
      () => import("../screens/orders/queue/screen"),
      "OrderQueueScreen",
    ),
    ...routeStates,
    pendingComponent: OrdersSkeleton,
  });
  const pickRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/orders/$orderId",
    loader: ({ context, params }: Context & { params: { orderId: string } }) =>
      context.queryClient.ensureQueryData(staffOrderQuery(params.orderId)),
    component: lazyRouteComponent(() => import("../screens/orders/pick/screen"), "PickScreen"),
    ...routeStates,
    pendingComponent: PickSkeleton,
  });
  return [queueRoute, pickRoute];
}
