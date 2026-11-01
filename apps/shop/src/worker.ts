import { cloudflareShopContext } from "@shopper/adapters-cf/shop";
import type { CloudflareShopEnvironment } from "@shopper/adapters-cf/shop";
import server from "./server";

export default {
  fetch(request: Request, env: CloudflareShopEnvironment) {
    return server.fetch(request, { context: cloudflareShopContext(env) });
  },
};
