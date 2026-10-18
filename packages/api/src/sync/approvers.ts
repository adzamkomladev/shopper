import { Hono } from "hono";
import { listApprovers, type createDeviceService } from "@shopper/auth/devices";
import type { ShopperDatabase } from "@shopper/db-pg";

/** `GET /sync/approvers`: the PIN hashes and approval grants a register keeps for offline approvals; read-only, not audited. */
export function createApproverRoutes(options: {
  database: ShopperDatabase;
  devices: ReturnType<typeof createDeviceService>;
}) {
  return new Hono().get("/sync/approvers", async (c) => {
    const principal = await options.devices.resolveUploadPrincipal(c.req.raw);
    if (!principal) return c.json({ error: "Invalid device credential" }, 401);
    return c.json({ approvers: await listApprovers(options.database, principal.orgId) });
  });
}
