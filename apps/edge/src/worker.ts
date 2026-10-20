import { cloudflareNotifications, cloudflareRuntime } from "@shopper/adapters-cf";

export default { fetch: cloudflareRuntime, queue: cloudflareNotifications };
