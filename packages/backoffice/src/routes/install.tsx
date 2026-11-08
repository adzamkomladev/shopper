import { createRoute, lazyRouteComponent, redirect, type AnyRoute } from "@tanstack/react-router";
import { routeStates } from "../components/route/states";
import { AuthSkeleton } from "../components/auth/skeleton";
import { installStateQuery } from "../queries/install/install";
import type { BackofficeContext } from "../types";

/** First-boot setup of a box with no shop (`/install`; the box sends `/setup` here). A shop that exists sends people to log in. */
export function installRoutes(rootRoute: AnyRoute) {
  return [
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/install",
      beforeLoad: async ({ context }: { context: BackofficeContext }) => {
        if (!(await context.queryClient.fetchQuery(installStateQuery())))
          throw redirect({ to: "/login" });
      },
      loader: ({ context }: { context: BackofficeContext }) =>
        context.queryClient.ensureQueryData(installStateQuery()),
      component: lazyRouteComponent(() => import("../screens/install/screen"), "InstallScreen"),
      ...routeStates,
      pendingComponent: () => <AuthSkeleton fields={1} />,
    }),
  ];
}
