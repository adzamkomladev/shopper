import assert from "node:assert/strict";
import { ratePolicies } from "@shopper/ports";
import type { ConformanceTest, RateLimiterFixture } from "../types";

export function rateLimiterConformance(
  name: string,
  test: ConformanceTest,
  fixture: RateLimiterFixture,
) {
  test(`${name}: RateLimiter spends a key's budget, then refuses it alone`, async () => {
    const { limiter } = await fixture();
    const key = `198.51.100.7:${crypto.randomUUID()}`;
    const budget = ratePolicies.auth.limit;
    const answers = [];
    for (let call = 0; call <= budget; call += 1) answers.push(await limiter.limit("auth", key));
    assert.deepEqual(answers, [...Array<boolean>(budget).fill(true), false]);
    assert.equal(await limiter.limit("auth", key), false);
    assert.equal(await limiter.limit("auth", `${key}:other`), true);
    // Policies count apart: spending sign-ins leaves the same client's public budget whole.
    assert.equal(await limiter.limit("public", key), true);
  });
}
