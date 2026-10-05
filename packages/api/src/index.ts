import { Hono } from "hono";
import { buildInfo } from "@shopper/config";
export function createApi() {
  const app = new Hono();
  app.use("*", async (c, next) => {
    await next();
    c.header("Shopper-Version", buildInfo.version);
  });
  app.get("/", (c) => c.json({ name: "Shopper", status: "hello" }));
  app.get("/health", (c) => c.json({ status: "ok", build: buildInfo }));
  app.get("/about", (c) => c.json(buildInfo));
  return app;
}
