import { serveShop } from "@shopper/api/shop";
import type { ShopContext } from "@shopper/api/shop";
import type { CloudflareShopEnvironment } from "./runtime/types";
export type { ShopContext } from "@shopper/api/shop";
export type { CloudflareShopEnvironment } from "./runtime/types";

/** The request context the shop Worker hands to TanStack Start; the binding never leaves this package. */
export function cloudflareShopContext(env: CloudflareShopEnvironment): ShopContext {
  return { shopApi: (request) => serveShop(request, (forwarded) => env.API.fetch(forwarded)) };
}
