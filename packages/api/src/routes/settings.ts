import { Hono, type Context } from "hono";
import { readCreditSettings, setCreditSettings } from "@shopper/core/customers";
import type { Queue } from "@shopper/ports";
import type { ShopperDatabase } from "@shopper/db-pg";
import { commandContext } from "./stock/context";
import { problem } from "../middleware/problem";
import { requirePermission } from "../middleware/require/permission";
import type { ApiAuthentication, ApiEnvironment } from "../types";

/** The org's account settings for the back office; reading and changing them needs `customer.manage`. */
export function settingsRoutes(
  database: ShopperDatabase,
  authentication: ApiAuthentication | undefined,
  notifications?: Queue,
) {
  const app = new Hono<ApiEnvironment>();
  app.use("/settings/credit", requirePermission(authentication, "customer.manage"));
  const org = (c: Context<ApiEnvironment>) => c.get("principal").orgId;
  const run = (c: Context<ApiEnvironment>) => commandContext(c.get("principal"), notifications);
  const body = (c: Context<ApiEnvironment>) => c.req.json().catch(() => undefined);

  app.get("/settings/credit", async (c) => c.json(await readCreditSettings(database, org(c))));
  app.put("/settings/credit", async (c) => {
    await setCreditSettings(database, run(c), { body: await body(c) });
    return c.json(await readCreditSettings(database, org(c)));
  });
  app.onError(problem);
  return app;
}
