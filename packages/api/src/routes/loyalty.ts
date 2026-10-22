import { Hono, type Context } from "hono";
import {
  archiveTier,
  createTier,
  listTiers,
  readLoyaltySettings,
  setLoyaltySettings,
  transferPoints,
  updateTier,
} from "@shopper/core/customers";
import type { Queue } from "@shopper/ports";
import type { ShopperDatabase } from "@shopper/db-pg";
import { commandContext } from "./stock/context";
import { problem } from "../middleware/problem";
import { requirePermission } from "../middleware/require/permission";
import type { ApiAuthentication, ApiEnvironment } from "../types";

/**
 * Loyalty for the back office: the org's settings, tiers and points transfers. The settings and every change need
 * `customer.manage`; tiers can be read with `customer.read`.
 */
export function loyaltyRoutes(
  database: ShopperDatabase,
  authentication: ApiAuthentication | undefined,
  notifications?: Queue,
) {
  const app = new Hono<ApiEnvironment>();
  const guard = requirePermission(authentication, (request) =>
    request.method === "GET" && new URL(request.url).pathname.startsWith("/loyalty/")
      ? "customer.read"
      : "customer.manage",
  );
  app.use("/settings/loyalty", guard).use("/loyalty/*", guard);
  const org = (c: Context<ApiEnvironment>) => c.get("principal").orgId;
  const run = (c: Context<ApiEnvironment>) => commandContext(c.get("principal"), notifications);
  const body = (c: Context<ApiEnvironment>) => c.req.json().catch(() => undefined);

  app.get("/settings/loyalty", async (c) => c.json(await readLoyaltySettings(database, org(c))));
  app.put("/settings/loyalty", async (c) => {
    await setLoyaltySettings(database, run(c), { body: await body(c) });
    return c.json(await readLoyaltySettings(database, org(c)));
  });
  app.get("/loyalty/tiers", async (c) => c.json(await listTiers(database, org(c))));
  app.post("/loyalty/tiers", async (c) =>
    c.json(await createTier(database, run(c), { body: await body(c) }), 201),
  );
  app.patch("/loyalty/tiers/:id", async (c) => {
    const { after } = await updateTier(database, run(c), {
      id: c.req.param("id"),
      body: await body(c),
    });
    return c.json(after);
  });
  app.post("/loyalty/tiers/:id/archive", async (c) =>
    c.json(await archiveTier(database, run(c), { id: c.req.param("id") })),
  );
  app.post("/loyalty/transfers", async (c) => {
    const { fromId, toId, points } = await transferPoints(database, run(c), {
      body: await body(c),
    });
    return c.json({ fromId, toId, points }, 201);
  });
  app.onError(problem);
  return app;
}
