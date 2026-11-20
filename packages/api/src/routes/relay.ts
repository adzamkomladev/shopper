import { Hono } from "hono";
import * as v from "valibot";
import { publicKeyOf, type Licence } from "@shopper/core/licence";
import { buildInfo } from "@shopper/config";
import { AssetError, offerRelayImage } from "@shopper/assets";
import type { Blobs, Queue, WorkflowLauncher } from "@shopper/ports";
import {
  applyRelayEvents,
  publishRelay,
  publishRelayCustomers,
  relayAccess,
  relayBatch,
  relayCustomers,
  relayHeartbeat,
  relayInbox,
  type RelayBox,
} from "@shopper/core/relay";
import type { ShopperDatabase } from "@shopper/db-pg";
import { problem } from "../middleware/problem";

type RelayEnvironment = { Variables: { relay: { licence: Licence; box: RelayBox } } };

/**
 * The relay (v1.5): an on-prem box publishes to and collects orders from its relay org over outbound requests (public
 * on purpose: each is signed by the box's licence key, used once, and acts on the org its licence names, never one
 * the request names).
 */
export function relayRoutes(options: {
  database: ShopperDatabase;
  licenceSigningKey: string;
  blobs?: Blobs;
  orderFlows?: WorkflowLauncher;
  notifications?: Queue;
}) {
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
  const context = (orgId: string) => ({
    orgId,
    role: "relay",
    appVersion: buildInfo.version,
    queue: options.notifications,
  });
  app.post("/relay/publish", async (c) => {
    const batch = v.parse(relayBatch, await c.req.json());
    return c.json(
      await publishRelay(db, context(c.get("relay").box.orgId), { batch, blobs: options.blobs }),
    );
  });
  // Opted-in customers' receipts and points, as the box's account pages show them (Day 51).
  app.post("/relay/customers", async (c) => {
    const batch = v.parse(relayCustomers, await c.req.json());
    return c.json(await publishRelayCustomers(db, context(c.get("relay").box.orgId), { batch }));
  });
  // A product photo by digest: an upload grant when the relay lacks those bytes, otherwise nothing to send.
  app.post("/relay/images", async (c) => {
    if (!options.blobs) throw new AssetError("Photo storage is unavailable", 503);
    const data = await c.req.json();
    return c.json(
      await offerRelayImage(db, context(c.get("relay").box.orgId), { blobs: options.blobs, data }),
    );
  });
  // The box's order inbox (Day 50): paid orders it has not taken, and what it did with them.
  app.get("/relay/orders", async (c) => c.json(await relayInbox(db, c.get("relay").box.orgId)));
  app.post("/relay/orders/events", async (c) => {
    if (!options.orderFlows) return c.json({ error: "Online orders are not running here" }, 503);
    return c.json(
      await applyRelayEvents(
        db,
        context(c.get("relay").box.orgId),
        options.orderFlows,
        await c.req.json(),
      ),
    );
  });
  app.onError(problem);
  return app;
}
