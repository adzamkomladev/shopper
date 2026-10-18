import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Query cache for the register sections. The till shell mounts it once per signed-in user, so a
 * sign-out drops everything fetched for the last one. Every route is on this register's host, so
 * nothing waits for the internet.
 */
export function RegisterProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { networkMode: "always", retry: false },
          mutations: { networkMode: "always" },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
