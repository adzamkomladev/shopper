import { expect, test } from "vite-plus/test";
import { createApi } from "../packages/api/src";
import { app } from "../apps/box/src";
test("Hono and the Elysia box host expose the same portable API", async () => {
  const api = createApi();
  for (const path of ["/", "/health", "/about", "/missing"]) {
    const cloudResponse = await api.request(`http://localhost${path}`);
    const boxResponse = await app.handle(new Request(`http://localhost${path}`));
    expect(boxResponse.status).toBe(cloudResponse.status);
    expect(boxResponse.headers.get("Shopper-Version")).toBe(
      cloudResponse.headers.get("Shopper-Version"),
    );
    expect(await boxResponse.text()).toBe(await cloudResponse.text());
  }
});
