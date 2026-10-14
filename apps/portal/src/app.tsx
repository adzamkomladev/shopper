import "./styles.css";

import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBackofficeRoutes, type BackofficeContext } from "@shopper/backoffice";
import { createRootRouteWithContext, createRouter, RouterProvider } from "@tanstack/react-router";

// Offline calls fail at once, so sign-in and sign-out show their error instead of hanging.
const queryClient = new QueryClient({
  defaultOptions: { queries: { networkMode: "always" }, mutations: { networkMode: "always" } },
});
const rootRoute = createRootRouteWithContext<BackofficeContext>()();
const router = createRouter({
  routeTree: createBackofficeRoutes(rootRoute),
  context: { queryClient },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
