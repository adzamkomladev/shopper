export type { Principal } from "./types";
import type { LiveUpgrade } from "./types";
export type { LiveUpgrade } from "./types";
import { Hono } from "hono";
import * as v from "valibot";
import { sequenceSchema } from "@shopper/ports";
import type { createDeviceService } from "@shopper/auth/devices";

export function createLiveRoutes(options: {
  devices: ReturnType<typeof createDeviceService>;
  live?: LiveUpgrade;
}) {
  return new Hono().get("/sync/live", async (c) => {
    const principal = await options.devices.resolveUploadPrincipal(c.req.raw);
    if (!principal) return c.json({ error: "Invalid device credential" }, 401);
    if (c.req.header("Upgrade")?.toLowerCase() !== "websocket")
      return c.json({ error: "Expected WebSocket upgrade" }, 426);
    const cursor = v.safeParse(sequenceSchema, c.req.query("cursor") ?? "0");
    if (!cursor.success) return c.json({ error: "Malformed sync cursor" }, 400);
    if (!options.live) return c.json({ error: "Realtime unavailable" }, 503);
    return options.live(c.req.raw, principal, cursor.output);
  });
}
