import type { QueryClient } from "@tanstack/react-query";

/** What the admin app's router hands every route. */
export type PlatformContext = { queryClient: QueryClient };
