import { env } from "cloudflare:test";
import { test } from "vitest";
import { cloudflareRateLimiter } from "@shopper/adapters-cf";
import { rateLimiterConformance } from "@shopper/conformance";

rateLimiterConformance("Cloudflare rate limiter in workerd", test, async () => ({
  limiter: cloudflareRateLimiter(env as Parameters<typeof cloudflareRateLimiter>[0]),
}));
