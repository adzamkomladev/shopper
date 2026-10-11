import type { QueryClient } from "@tanstack/react-query";

/** What the host app puts in its router context for the back-office routes. */
export type BackofficeContext = { queryClient: QueryClient };
