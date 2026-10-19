import { SELF } from "cloudflare:test";
import { expect, test } from "vitest";
import { v7 } from "uuid";

test("GET /sync/approvers in workerd needs a device credential", async () => {
  const get = (headers: Record<string, string> = {}) =>
    SELF.fetch("https://shopper.test/sync/approvers", { headers });
  expect((await get()).status).toBe(401);
  const forged = { authorization: `Bearer ${"0".repeat(64)}`, "X-Shopper-Device": v7() };
  expect((await get(forged)).status).toBe(401);
});
