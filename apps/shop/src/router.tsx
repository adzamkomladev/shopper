import { QueryClient } from "@tanstack/react-query";
import type { ShopContext } from "@shopper/api/shop";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: false } },
  });
  return createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    // A receipt card morphs into its page; reduced motion turns the transition off (theme.css).
    defaultViewTransition: true,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
    server: { requestContext: ShopContext };
  }
}
