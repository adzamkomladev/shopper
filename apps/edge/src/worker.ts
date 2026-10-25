import {
  cloudflareNotifications,
  cloudflareRuntime,
  cloudflareWatchdog,
} from "@shopper/adapters-cf";

export default {
  fetch: cloudflareRuntime,
  queue: cloudflareNotifications,
  scheduled: cloudflareWatchdog,
};
