import { expect, test } from "vite-plus/test";
import { ratePolicies } from "@shopper/ports";
import { boxRateLimiter } from "@shopper/adapters-box";
import { rateLimiterConformance } from "@shopper/conformance";

rateLimiterConformance("box rate limiter", test, async () => ({ limiter: boxRateLimiter() }));

test("box rate limiter: a spent key gets its budget back when its window ends", async () => {
  let now = 1_000_000;
  const limiter = boxRateLimiter(() => now);
  for (let call = 0; call < ratePolicies.public.limit; call += 1)
    expect(await limiter.limit("public", "203.0.113.9")).toBe(true);
  expect(await limiter.limit("public", "203.0.113.9")).toBe(false);
  now += ratePolicies.public.period * 1000 - 1;
  expect(await limiter.limit("public", "203.0.113.9")).toBe(false);
  now += 1;
  expect(await limiter.limit("public", "203.0.113.9")).toBe(true);
});
