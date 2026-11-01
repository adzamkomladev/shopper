import { createFileRoute, redirect } from "@tanstack/react-router";

/** The shop's link opens the account; a browser with no session is sent on to sign in from there. */
export const Route = createFileRoute("/$shop/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/$shop/account", params });
  },
});
