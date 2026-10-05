import { SELF } from "cloudflare:test";
import { expect, test } from "vitest";

test("shared Hono API runs inside workerd and reports its baked version", async () => {
  const response = await SELF.fetch("https://shopper.test/health");
  expect(response.status).toBe(200);
  const data = (await response.json()) as {
    status: string;
    build: { version: string; schemaVersion: number };
  };
  expect(data.status).toBe("ok");
  expect(data.build.schemaVersion).toBe(1);
  expect(response.headers.get("Shopper-Version")).toBe(data.build.version);
  const missing = await SELF.fetch("https://shopper.test/missing");
  expect(missing.status).toBe(404);
  expect(missing.headers.get("Shopper-Version")).toBe(data.build.version);
});
