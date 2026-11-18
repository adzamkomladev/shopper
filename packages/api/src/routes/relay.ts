import { Hono } from "hono";
import * as v from "valibot";
import { publicKeyOf, type Licence } from "@shopper/core/licence";
import { buildInfo } from "@shopper/config";
import {
  publishRelay,
  relayAccess,
  relayBatch,
  relayHeartbeat,
  relayInbox,
  type RelayBox,
} from "@shopper/core/relay";
import type { ShopperDatabase } from "@shopper/db-pg";
import { problem } from "../middleware/problem";
import { relayCursor } from "../schemas/relay";

type RelayEnvironment = { Variables: { relay: { licence: Licence; box: RelayBox } } };

/**
 * The relay (v1.5): an on-prem box publishes to and collects orders from its relay org over outbound requests (public
 * on purpose: each is signed by the box's licence key, used once, and acts on the org its licence names, never one
 * the request names).
 */
export function relayRoutes(options: { database: ShopperDatabase; licenceSigningKey: string }) {
  const app = new Hono<RelayEnvironment>();
  const db = options.database;
  app.use("/relay/*", async (c, next) => {
    const access = await relayAccess(db, c.req.raw, {
      issuer: publicKeyOf(options.licenceSigningKey),
    });
    if ("error" in access) return c.json({ error: access.error }, access.status);
    c.set("relay", access);
    await next();
  });
  app.get("/relay/status", (c) => {
    const relay = c.get("relay");
    return c.json({
      orgId: relay.box.orgId,
      licenceId: relay.box.licenceId,
      onlineOrders: relay.box.onlineOrders,
      maintenanceUntil: relay.licence.maintenanceUntil,
      lastSeenAt: relay.box.lastSeenAt,
    });
  });
  app.post("/relay/heartbeat", async (c) => c.json(await relayHeartbeat(db, c.get("relay").box)));
  app.post("/relay/publish", async (c) => {
    const batch = v.parse(relayBatch, await c.req.json());
    const orgId = c.get("relay").box.orgId;
    return c.json(
      await publishRelay(db, { orgId, role: "relay", appVersion: buildInfo.version }, batch),
    );
  });
  app.get("/relay/orders", async (c) =>
    c.json(
      await relayInbox(db, c.get("relay").box.orgId, v.parse(relayCursor, c.req.query("after"))),
    ),
  );
  app.onError(problem);
  return app;
}
