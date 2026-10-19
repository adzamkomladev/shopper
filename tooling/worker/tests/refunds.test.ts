import { SELF } from "cloudflare:test";
import { expect, test } from "vitest";
import { v7 } from "uuid";

test("/sync/refunds and /sync/sales/lookup in workerd need a device credential", async () => {
  const forged = { authorization: `Bearer ${"0".repeat(64)}`, "X-Shopper-Device": v7() };
  const post = (headers: Record<string, string> = {}) =>
    SELF.fetch("https://shopper.test/sync/refunds", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: "{}",
    });
  const get = (headers: Record<string, string> = {}) =>
    SELF.fetch("https://shopper.test/sync/sales/lookup?receipt=BR01-T01-000001", { headers });
  for (const headers of [undefined, forged]) {
    expect((await post(headers)).status).toBe(401);
    expect((await get(headers)).status).toBe(401);
  }
});
