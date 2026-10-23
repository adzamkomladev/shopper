import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { routeStates } from "../components/route/states";
import { KycQueueSkeleton } from "../components/kyc/queue/states";
import { KycReviewSkeleton } from "../components/kyc/review/states";
import { kycCaseQuery, kycListQuery, kycSubjectQuery } from "../queries/kyc/cases";
import { permissionsQuery } from "../queries/session/permissions";
import { kycQueueSearch } from "../schemas/kyc";
import type { BackofficeContext } from "../types";

type Context = { context: BackofficeContext };

/** Identity checks: the queue, and one check to review. Reading them needs `customer.manage`; deciding needs `kyc.approve`. */
export function kycRoutes(shopRoute: AnyRoute) {
  const queueRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/kyc",
    validateSearch: kycQueueSearch,
    loader: ({ context }: Context) => context.queryClient.ensureQueryData(kycListQuery()),
    component: lazyRouteComponent(() => import("../screens/kyc/queue/screen"), "KycQueueScreen"),
    ...routeStates,
    pendingComponent: KycQueueSkeleton,
  });
  const caseRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/kyc/$caseId",
    loader: async ({ context, params }: Context & { params: { caseId: string } }) => {
      const [kase] = await Promise.all([
        context.queryClient.ensureQueryData(kycCaseQuery(params.caseId)),
        context.queryClient.ensureQueryData(permissionsQuery()),
      ]);
      // The name only dresses the page; a member who may not read customers still sees the check by its phone.
      if (kase.customerId)
        await context.queryClient.prefetchQuery(kycSubjectQuery(kase.customerId));
    },
    component: lazyRouteComponent(() => import("../screens/kyc/review/screen"), "KycReviewScreen"),
    ...routeStates,
    pendingComponent: KycReviewSkeleton,
  });
  return [queueRoute, caseRoute];
}
