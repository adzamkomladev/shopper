import "../styles.css";
import { QueryClientProvider } from "@tanstack/react-query";
import type { BackofficeContext } from "@shopper/backoffice";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import { HostMeta } from "../components/host/meta";

export const Route = createRootRouteWithContext<BackofficeContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Shopper" },
    ],
  }),
  component: Portal,
  shellComponent: Document,
});

function Portal() {
  const { queryClient } = useRouter().options.context;
  return (
    <QueryClientProvider client={queryClient}>
      <HostMeta />
      <Outlet />
    </QueryClientProvider>
  );
}

function Document({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
