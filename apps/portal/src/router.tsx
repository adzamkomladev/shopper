import { QueryClient } from "@tanstack/react-query";
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
    // Shared backoffice loaders use the browser's selected shop and run after hydration.
    defaultSsr: false,
    scrollRestoration: true,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
    server: { requestContext: { portalRuntime: (request: Request) => Promise<Response> } };
  }
}
