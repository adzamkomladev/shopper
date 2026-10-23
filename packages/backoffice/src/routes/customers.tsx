import type * as v from "valibot";
import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { CustomerSkeleton } from "../components/customers/detail/states";
import { CustomersSkeleton } from "../components/customers/list/states";
import { routeStates } from "../components/route/states";
import { customerQuery, customersListQuery } from "../queries/customers/list";
import { customersSearch } from "../schemas/routes";
import type { BackofficeContext } from "../types";
import { whenHeld } from "./held";

type Context = { context: BackofficeContext };

/** The customer list and a customer's page. */
export function customerRoutes(shopRoute: AnyRoute) {
  const listRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/customers",
    validateSearch: customersSearch,
    loaderDeps: ({ search }) => search,
    loader: ({ context, deps }: Context & { deps: v.InferOutput<typeof customersSearch> }) =>
      whenHeld(context, "customer.read", () => {
        // Only started: the screen shows its own skeleton, so the heading and toolbar are there at once.
        void context.queryClient.prefetchInfiniteQuery(
          customersListQuery({
            q: deps.q,
            archived: deps.segment === "archived",
            business: deps.segment === "business",
          }),
        );
      }),
    component: lazyRouteComponent(
      () => import("../screens/customers/list/screen"),
      "CustomersScreen",
    ),
    ...routeStates,
    pendingComponent: CustomersSkeleton,
  });
  const customerRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/customers/$customerId",
    loader: ({ context, params }: Context & { params: { customerId: string } }) =>
      whenHeld(context, "customer.read", () =>
        context.queryClient.ensureQueryData(customerQuery(params.customerId)),
      ),
    component: lazyRouteComponent(
      () => import("../screens/customers/detail/screen"),
      "CustomerScreen",
    ),
    ...routeStates,
    pendingComponent: CustomerSkeleton,
  });
  return [listRoute, customerRoute];
}
