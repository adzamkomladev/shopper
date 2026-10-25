import type * as v from "valibot";
import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { routeStates } from "../components/route/states";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { AuditPage } from "../components/audit/tabs";
import { AuditLogSkeleton } from "../components/audit/log/states";
import { IntegritySkeleton } from "../components/audit/integrity/states";
import { auditFacetsQuery, auditListQuery } from "../queries/audit/log";
import { auditStreamsQuery } from "../queries/audit/integrity";
import { auditSearch } from "../schemas/audit";
import type { BackofficeContext } from "../types";
import { whenHeld } from "./held";

type Context = { context: BackofficeContext };

/** The audit area: the merged log and the chains' integrity. Both need audit.read. */
export function auditRoutes(shopRoute: AnyRoute) {
  const logRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/audit",
    validateSearch: auditSearch,
    loaderDeps: ({ search }) => ({ ...search, entry: undefined }),
    loader: ({ context, deps }: Context & { deps: v.InferOutput<typeof auditSearch> }) =>
      whenHeld(context, "audit.read", () => {
        void context.queryClient.prefetchInfiniteQuery(auditListQuery(deps));
        return context.queryClient.ensureQueryData(auditFacetsQuery());
      }),
    component: lazyRouteComponent(() => import("../screens/audit/log/screen"), "AuditLogScreen"),
    ...routeStates,
    // The heading, tabs and action stay put; only the tab's body is a skeleton.
    pendingComponent: () => (
      <AuditPage active="log" action={<Skeleton className="h-9 w-38.5" />}>
        <AuditLogSkeleton />
      </AuditPage>
    ),
  });
  const integrityRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/audit/integrity",
    loader: ({ context }: Context) =>
      whenHeld(context, "audit.read", () =>
        context.queryClient.ensureQueryData(auditStreamsQuery()),
      ),
    component: lazyRouteComponent(
      () => import("../screens/audit/integrity/screen"),
      "AuditIntegrityScreen",
    ),
    ...routeStates,
    pendingComponent: () => (
      <AuditPage active="integrity" action={<Skeleton className="h-9 w-33.5" />}>
        <IntegritySkeleton />
      </AuditPage>
    ),
  });
  return [logRoute, integrityRoute];
}
