import { SELF } from "cloudflare:test";
import { expect, test } from "vitest";
import { v7 } from "uuid";

test("/sync/shifts in workerd needs a device credential", async () => {
  const forged = { authorization: `Bearer ${"0".repeat(64)}`, "X-Shopper-Device": v7() };
  for (const headers of [undefined, forged]) {
    const response = await SELF.fetch("https://shopper.test/sync/shifts", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: "{}",
    });
    expect(response.status).toBe(401);
  }
});
