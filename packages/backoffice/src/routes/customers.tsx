import type * as v from "valibot";
import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { AgeingSkeleton } from "../components/customers/ageing/states";
import { CustomerSkeleton } from "../components/customers/detail/states";
import { CustomersSkeleton } from "../components/customers/list/states";
import { routeStates } from "../components/route/states";
import { ageingQuery, customerLoyaltyQuery } from "../queries/customers/account";
import { customerQuery, customersListQuery } from "../queries/customers/list";
import { customerSearch, customersSearch } from "../schemas/routes";
import type { BackofficeContext } from "../types";
import { whenHeld } from "./held";

type Context = { context: BackofficeContext };

/** The customer list, the ageing report and a customer's page. */
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
          customersListQuery({ q: deps.q, segment: deps.segment }),
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
    validateSearch: customerSearch,
    loader: ({ context, params }: Context & { params: { customerId: string } }) =>
      whenHeld(context, "customer.read", () =>
        Promise.all([
          context.queryClient.ensureQueryData(customerQuery(params.customerId)),
          // The tier shows in the first paint; one that can't be read must not stop the page.
          context.queryClient
            .ensureQueryData(customerLoyaltyQuery(params.customerId))
            .catch(() => undefined),
        ]),
      ),
    component: lazyRouteComponent(
      () => import("../screens/customers/detail/screen"),
      "CustomerScreen",
    ),
    ...routeStates,
    pendingComponent: CustomerSkeleton,
  });
  const ageingRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/customers/ageing",
    loader: ({ context }: Context) =>
      whenHeld(context, "customer.read", () => {
        // Only started: the screen shows its own skeleton, so the heading and tabs are there at once.
        void context.queryClient.prefetchQuery(ageingQuery());
      }),
    component: lazyRouteComponent(
      () => import("../screens/customers/ageing/screen"),
      "AgeingScreen",
    ),
    ...routeStates,
    pendingComponent: AgeingSkeleton,
  });
  return [listRoute, ageingRoute, customerRoute];
}
