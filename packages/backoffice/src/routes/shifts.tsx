import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { routeStates } from "../components/route/states";
import { ShiftError, ShiftSkeleton } from "../components/shifts/detail/states";
import { ShiftsSkeleton } from "../components/shifts/list/states";
import { shiftQuery } from "../queries/shifts/detail";
import { shiftsQuery } from "../queries/shifts/list";
import type { BackofficeContext } from "../types";

type Context = { context: BackofficeContext };

/** Closed shifts and their Z reports, for members who hold `shift.read`. */
export function shiftRoutes(shopRoute: AnyRoute) {
  const listRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/shifts",
    loader: ({ context }: Context) => context.queryClient.ensureQueryData(shiftsQuery()),
    component: lazyRouteComponent(() => import("../screens/shifts/list/screen"), "ShiftsScreen"),
    ...routeStates,
    pendingComponent: ShiftsSkeleton,
  });
  const detailRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/shifts/$shiftId",
    loader: ({ context, params }: Context & { params: { shiftId: string } }) =>
      context.queryClient.ensureQueryData(shiftQuery(params.shiftId)),
    component: lazyRouteComponent(() => import("../screens/shifts/detail/screen"), "ShiftScreen"),
    ...routeStates,
    errorComponent: ShiftError,
    pendingComponent: ShiftSkeleton,
  });
  return [listRoute, detailRoute];
}
