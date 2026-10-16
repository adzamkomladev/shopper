import { paymentRoutes } from "./payments/routes";
import { createSyncRoutes } from "./sync/routes";
import { onboardingRoutes } from "./routes/onboarding";
import { invitationRoutes } from "./routes/invitations";
import { Hono } from "hono";
import { buildInfo } from "@shopper/config";
import { catalogueRoutes } from "./routes/catalogue";
import { administrationRoutes } from "./routes/administration";
import { deviceRoutes } from "./routes/devices";
import { managementRoutes } from "./routes/management";
import { systemRoutes } from "./routes/system";
import { taxRuleRoutes } from "./routes/tax/rules";
import type { ApiEnvironment, ApiOptions } from "./types";

export function createApi(options: ApiOptions = {}) {
  const app = new Hono<ApiEnvironment>();
  app.use("*", async (c, next) => {
    await next();
    c.header("Shopper-Version", buildInfo.version);
  });
  app.route("/", systemRoutes());
  app.route("/", paymentRoutes(options));
  if (options.database && options.devices && options.sequencer)
    app.route(
      "/",
      createSyncRoutes({
        database: options.database,
        devices: options.devices,
        sequencer: options.sequencer,
        blobs: options.blobs,
      }),
    );
  if (options.onboarding) app.route("/", onboardingRoutes(options.onboarding));
  if (options.invitations)
    app.route("/", invitationRoutes(options.invitations, options.authentication));
  app.route("/", taxRuleRoutes(options));
  if (options.database)
    app.route(
      "/",
      catalogueRoutes({
        database: options.database,
        authentication: options.authentication,
        priceChange: options.priceChange,
        blobs: options.blobs,
        realtime: options.realtime,
      }),
    );
  if (options.authentication?.handler)
    app.all("/api/auth/*", (c) => options.authentication!.handler!(c.req.raw));
  app.route("/", managementRoutes(options));
  app.route("/", administrationRoutes(options));
  if (options.devices) app.route("/", deviceRoutes(options.devices, options.authentication));
  return app;
}
