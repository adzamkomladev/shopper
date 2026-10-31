import type { RateLimiter, RatePolicy } from "@shopper/ports";
import type { RateLimitEnvironment } from "./runtime/types";

/** Cloudflare's Rate Limiting binding: counted at the edge location, near the client. */
export function cloudflareRateLimiter(env: RateLimitEnvironment): RateLimiter {
  return {
    async limit(policy, key) {
      const binding = `RATE_${policy.toUpperCase() as Uppercase<RatePolicy>}` as const;
      return (await env[binding].limit({ key })).success;
    },
  };
}
