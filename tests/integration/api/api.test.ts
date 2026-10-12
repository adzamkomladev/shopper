import { expect, test } from "vite-plus/test";
import { createApi } from "@shopper/api";
import { app } from "@shopper/box";
test("Cloud and Bun Hono hosts expose the same portable API", async () => {
  const api = createApi();
  for (const path of ["/", "/health", "/about", "/missing"]) {
    const cloudResponse = await api.request(`http://localhost${path}`);
    const boxResponse = await app.fetch(new Request(`http://localhost${path}`));
    expect(boxResponse.status).toBe(cloudResponse.status);
    expect(boxResponse.headers.get("Shopper-Version")).toBe(
      cloudResponse.headers.get("Shopper-Version"),
    );
    expect(await boxResponse.text()).toBe(await cloudResponse.text());
  }
});

test("box runtime keeps health public and fails closed when auth is not configured", async () => {
  const { createBoxApp } = await import("@shopper/box");
  const runtime = createBoxApp({});
  expect((await runtime.fetch(new Request("http://localhost/health"))).status).toBe(200);
  expect((await runtime.fetch(new Request("http://localhost/stores"))).status).toBe(503);
  expect(
    (
      await runtime.fetch(
        new Request("http://localhost/api/auth/sign-in/email", { method: "POST" }),
      )
    ).status,
  ).toBe(503);
});
