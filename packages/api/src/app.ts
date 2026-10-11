import { Hono } from "hono";
import { buildInfo } from "@shopper/config";
import { catalogueRoutes } from "./routes/catalogue";
import { deviceRoutes } from "./routes/devices";
import { managementRoutes } from "./routes/management";
import { systemRoutes } from "./routes/system";
import { taxRuleRoutes } from "./routes/tax-rules";
import type { ApiEnvironment, ApiOptions } from "./types";

export function createApi(options: ApiOptions = {}) {
  const app = new Hono<ApiEnvironment>();
  app.use("*", async (c, next) => {
    await next();
    c.header("Shopper-Version", buildInfo.version);
  });
  app.route("/", systemRoutes());
  app.route("/", taxRuleRoutes(options));
  if (options.database)
    app.route(
      "/",
      catalogueRoutes({
        database: options.database,
        authentication: options.authentication,
        priceChange: options.priceChange,
      }),
    );
  if (options.authentication?.handler)
    app.all("/api/auth/*", (c) => options.authentication!.handler!(c.req.raw));
  app.route("/", managementRoutes(options));
  if (options.devices) app.route("/", deviceRoutes(options.devices, options.authentication));
  return app;
}
