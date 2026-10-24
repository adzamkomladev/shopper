import { Hono, type Context } from "hono";
import {
  readCreditSettings,
  readStatementSettings,
  setCreditSettings,
  setStatementSettings,
} from "@shopper/core/customers";
import { readTaxSettings, setTaxSettings } from "@shopper/core/tax";
import type { Queue } from "@shopper/ports";
import type { ShopperDatabase } from "@shopper/db-pg";
import { commandContext } from "./stock/context";
import { problem } from "../middleware/problem";
import { requirePermission } from "../middleware/require/permission";
import type { ApiAuthentication, ApiEnvironment } from "../types";

/**
 * The org's settings for the back office. Account settings need `customer.manage`; tax settings are read with
 * `tax.read` and changed with `tax.write`.
 */
export function settingsRoutes(
  database: ShopperDatabase,
  authentication: ApiAuthentication | undefined,
  notifications?: Queue,
) {
  const app = new Hono<ApiEnvironment>();
  const guard = requirePermission(authentication, "customer.manage");
  app.use("/settings/credit", guard).use("/settings/statements", guard);
  app.get("/settings/tax", requirePermission(authentication, "tax.read"));
  app.put("/settings/tax", requirePermission(authentication, "tax.write"));
  const org = (c: Context<ApiEnvironment>) => c.get("principal").orgId;
  const run = (c: Context<ApiEnvironment>) => commandContext(c.get("principal"), notifications);
  const body = (c: Context<ApiEnvironment>) => c.req.json().catch(() => undefined);

  app.get("/settings/credit", async (c) => c.json(await readCreditSettings(database, org(c))));
  app.put("/settings/credit", async (c) => {
    await setCreditSettings(database, run(c), { body: await body(c) });
    return c.json(await readCreditSettings(database, org(c)));
  });
  app.get("/settings/statements", async (c) =>
    c.json(await readStatementSettings(database, org(c))),
  );
  app.put("/settings/statements", async (c) => {
    await setStatementSettings(database, run(c), { body: await body(c) });
    return c.json(await readStatementSettings(database, org(c)));
  });
  app.get("/settings/tax", async (c) => c.json(await readTaxSettings(database, org(c))));
  app.put("/settings/tax", async (c) => {
    await setTaxSettings(database, run(c), { body: await body(c) });
    return c.json(await readTaxSettings(database, org(c)));
  });
  app.onError(problem);
  return app;
}
