import { invitationSearch } from "../../schemas/auth/public";
import { link } from "../../schemas/auth/public";
import { createRoute, lazyRouteComponent, redirect, type AnyRoute } from "@tanstack/react-router";
import * as v from "valibot";
import { routeStates } from "../../components/route/states";
import { linkProblemScreen } from "../../components/auth/link/problem";
import { AuthSkeleton } from "../../components/auth/skeleton";
import { currentOrgQuery } from "../../queries/session/session";
import { invitationQuery } from "../../queries/auth/accept/invitation";
import { registrationQuery } from "../../queries/auth/verify/registration";
import { brokenLink } from "../../api/auth/public/api";
import type { BackofficeContext } from "../../types";

type Context = { context: BackofficeContext };

const PENDING_MS = 300;

// A box serves one shop and has no public registration: its people log in or accept invitations.
async function closeOnFixedBox({ context }: Context) {
  if (await context.queryClient.ensureQueryData(currentOrgQuery)) throw redirect({ to: "/login" });
}

/** Signed-out onboarding: create a shop, verify its email link, and accept a staff invitation. */
export function publicAuthRoutes(rootRoute: AnyRoute) {
  const signupRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/signup",
    beforeLoad: closeOnFixedBox,
    component: lazyRouteComponent(() => import("../../screens/auth/signup/screen"), "SignupScreen"),
    ...routeStates,
    pendingComponent: AuthSkeleton,
  });
  const verifyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/verify-registration",
    validateSearch: link,
    beforeLoad: closeOnFixedBox,
    loaderDeps: ({ search }) => ({ id: search.id }),
    shouldReload: true,
    gcTime: 0,
    loader: ({ context, location }: Context & { location: { search: unknown } }) => {
      const { id, token } = v.parse(link, location.search);
      if (!id || !token) brokenLink();
      const preview = registrationQuery({ id, token });
      context.queryClient.removeQueries({ queryKey: preview.queryKey, exact: true });
      return context.queryClient.ensureQueryData(preview);
    },
    component: lazyRouteComponent(
      () => import("../../screens/auth/verify/registration/screen"),
      "VerifyRegistrationScreen",
    ),
    errorComponent: linkProblemScreen("verification"),
    pendingComponent: AuthSkeleton,
    pendingMs: PENDING_MS,
  });
  const inviteRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/accept-invitation",
    validateSearch: invitationSearch,
    loaderDeps: ({ search }) => ({ id: search.id }),
    shouldReload: true,
    gcTime: 0,
    loader: ({ context, location }: Context & { location: { search: unknown } }) => {
      const { id, token } = v.parse(link, location.search);
      if (!id || !token) brokenLink();
      const preview = invitationQuery({ id, token });
      context.queryClient.removeQueries({ queryKey: preview.queryKey, exact: true });
      return context.queryClient.ensureQueryData(preview);
    },
    component: lazyRouteComponent(
      () => import("../../screens/auth/accept/invitation/screen"),
      "AcceptInvitationScreen",
    ),
    errorComponent: linkProblemScreen("invitation"),
    pendingComponent: AuthSkeleton,
    pendingMs: PENDING_MS,
  });
  return [signupRoute, verifyRoute, inviteRoute];
}
