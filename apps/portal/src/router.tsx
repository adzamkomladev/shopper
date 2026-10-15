import { QueryClient } from "@tanstack/react-query";
import type { PortalContext } from "@shopper/adapters-cf/portal";
import { createBackofficeRoutes } from "@shopper/backoffice";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { networkMode: "always" }, mutations: { networkMode: "always" } },
  });
  return createRouter({
    routeTree: createBackofficeRoutes(routeTree),
    context: { queryClient },
    scrollRestoration: true,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
    server: { requestContext: PortalContext };
  }
}
