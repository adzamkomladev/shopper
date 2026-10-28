import { createRoute, lazyRouteComponent, redirect, type AnyRoute } from "@tanstack/react-router";
import { LoginSkeleton, routeStates, ShellSkeleton } from "@shopper/backoffice/kit";
import { KybQueueSkeleton } from "../components/kyb/queue/states";
import { KybReviewSkeleton } from "../components/kyb/review/states";
import { TenantsSkeleton } from "../components/tenants/list/states";
import { kybCaseQuery, kybQueueQuery, platformOrgQuery, tenantsQuery } from "../queries/platform";
import { requireStaff } from "../queries/session";
import { queueSearch } from "../schemas/platform";
import type { QueueTab } from "../schemas/types";
import type { PlatformContext } from "../types";

type Context = { context: PlatformContext };

/** Staff sign-in and the signed-in pages: the verification queue, one case, and every shop. */
export function createPlatformRoutes(rootRoute: AnyRoute) {
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    beforeLoad: () => {
      throw redirect({ to: "/kyb" });
    },
  });
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/login",
    loader: ({ context }: Context) => context.queryClient.ensureQueryData(platformOrgQuery),
    component: lazyRouteComponent(() => import("../screens/auth/login/screen"), "LoginScreen"),
    ...routeStates,
    pendingComponent: LoginSkeleton,
  });
  const staffRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: "_staff",
    beforeLoad: ({ context }: Context) => requireStaff(context.queryClient),
    component: lazyRouteComponent(() => import("../screens/shell/screen"), "ShellScreen"),
    ...routeStates,
    pendingComponent: ShellSkeleton,
  });
  const queueRoute = createRoute({
    getParentRoute: () => staffRoute,
    path: "/kyb",
    validateSearch: queueSearch,
    loaderDeps: ({ search }) => search,
    loader: ({ context, deps }: Context & { deps: { status: QueueTab } }) =>
      context.queryClient.ensureQueryData(kybQueueQuery(deps.status)),
    component: lazyRouteComponent(() => import("../screens/kyb/queue/screen"), "KybQueueScreen"),
    ...routeStates,
    pendingComponent: KybQueueSkeleton,
  });
  const caseRoute = createRoute({
    getParentRoute: () => staffRoute,
    path: "/kyb/$orgId",
    loader: ({ context, params }: Context & { params: { orgId: string } }) =>
      context.queryClient.ensureQueryData(kybCaseQuery(params.orgId)),
    component: lazyRouteComponent(() => import("../screens/kyb/review/screen"), "KybReviewScreen"),
    ...routeStates,
    pendingComponent: KybReviewSkeleton,
  });
  const tenantsRoute = createRoute({
    getParentRoute: () => staffRoute,
    path: "/tenants",
    loader: ({ context }: Context) => context.queryClient.ensureQueryData(tenantsQuery()),
    component: lazyRouteComponent(() => import("../screens/tenants/list/screen"), "TenantsScreen"),
    ...routeStates,
    pendingComponent: TenantsSkeleton,
  });
  return rootRoute.addChildren([
    indexRoute,
    loginRoute,
    staffRoute.addChildren([queueRoute, caseRoute, tenantsRoute]),
  ]);
}
