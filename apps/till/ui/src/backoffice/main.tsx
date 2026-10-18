import "../styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { createRoot } from "react-dom/client";
import { createBackofficeRoutes, type BackofficeContext } from "@shopper/backoffice";

// The full back office, served by the register host at /backoffice/ and talking to its same-origin /api
// (the host answers some routes itself and proxies the rest upstream). Staff sign in on the register.
const queryClient = new QueryClient({
  defaultOptions: { queries: { networkMode: "always" }, mutations: { networkMode: "always" } },
});
const root = createRootRouteWithContext<BackofficeContext>()({ component: Outlet });
const router = createRouter({
  routeTree: createBackofficeRoutes(root, { signIn: "/" }),
  basepath: "/backoffice",
  context: { queryClient },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
