import { createRoute, lazyRouteComponent, type AnyRoute } from "@tanstack/react-router";
import { StatementError, StatementSkeleton } from "../../components/statements/public/states";
import { statementQuery } from "../../queries/statements/public";
import type { BackofficeContext } from "../../types";

// A skeleton shows after this long, so a fast load never flashes one.
const PENDING_MS = 300;

/** The page a customer's statement link opens. It sits outside the signed-in shell: no session, no navigation. */
export function publicStatementRoutes(rootRoute: AnyRoute) {
  const statementRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/statement/$token",
    head: () => ({ meta: [{ title: "Your statement" }] }),
    // The link is the credential: the page is never kept once the customer leaves it.
    gcTime: 0,
    loader: ({ context, params }: { context: BackofficeContext; params: { token: string } }) =>
      context.queryClient.ensureQueryData(statementQuery(params.token)),
    component: lazyRouteComponent(
      () => import("../../screens/statements/public/screen"),
      "PublicStatementScreen",
    ),
    errorComponent: StatementError,
    pendingComponent: StatementSkeleton,
    pendingMs: PENDING_MS,
  });
  return [statementRoute];
}
