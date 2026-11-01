import "../styles.css";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import { ShortcutRoot } from "@shopper/ui/hooks/shortcuts";
import { Toaster } from "@shopper/ui/components/sonner";
import { themeScript } from "@shopper/ui/hooks/theme";
import { Missing } from "../components/shop/missing";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Your receipts" },
    ],
    links: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
  }),
  component: Shop,
  shellComponent: Document,
  notFoundComponent: () => (
    <Missing
      title="This page is not here"
      description="Open the link your shop gave you, or ask the cashier for it."
    />
  ),
});

function Shop() {
  const { queryClient } = useRouter().options.context;
  return (
    <QueryClientProvider client={queryClient}>
      <ShortcutRoot className="min-h-dvh">
        <Outlet />
      </ShortcutRoot>
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}

function Document({ children }: { children: React.ReactNode }) {
  return (
    // The theme script sets data-theme before React hydrates.
    <html lang="en" data-surface="shop" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body className="bg-shop-page text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
