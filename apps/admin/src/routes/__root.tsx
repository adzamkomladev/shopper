import "../styles.css";
import { QueryClientProvider } from "@tanstack/react-query";
import type { PlatformContext } from "@shopper/platform";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouter,
} from "@tanstack/react-router";

export const Route = createRootRouteWithContext<PlatformContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "robots", content: "noindex" },
      { title: "Shopper Admin" },
    ],
  }),
  component: Admin,
  shellComponent: Document,
});

function Admin() {
  const { queryClient } = useRouter().options.context;
  return (
    <QueryClientProvider client={queryClient}>
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
