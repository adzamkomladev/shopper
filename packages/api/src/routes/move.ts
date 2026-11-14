import { Hono } from "hono";
import * as v from "valibot";
import { eq } from "drizzle-orm";
import { device, type ShopperDatabase } from "@shopper/db-pg";
import { cloudMoveBody, getCloudMove, ImportError, requestCloudMove } from "@shopper/export";
import type { WorkflowLauncher } from "@shopper/ports";
import { commandContext } from "./stock/context";
import { requireOrgWide } from "../middleware/require/branches";
import { requirePermission } from "../middleware/require/permission";
import type { ApiAuthentication, ApiEnvironment } from "../types";

/**
 * The box's "Move to cloud" (migration.run, box only): start the move, then follow it until every register has been
 * handed its relocation.
 */
export function moveRoutes(
  database: ShopperDatabase,
  authentication: ApiAuthentication | undefined,
  cloudMoves: WorkflowLauncher,
) {
  const app = new Hono<ApiEnvironment>();
  app.use("/migration/move", requirePermission(authentication, "migration.run"), requireOrgWide);
  app.get("/migration/move", async (c) => {
    const orgId = c.get("principal").orgId;
    const move = await getCloudMove(database, orgId);
    const registers = await database
      .select({ id: device.id, name: device.name })
      .from(device)
      .where(eq(device.orgId, orgId))
      .orderBy(device.name);
    return c.json({
      move: move
        ? {
            id: move.id,
            status: move.status,
            cloudUrl: move.cloudUrl,
            error: move.error,
            startedAt: move.createdAt.toISOString(),
            completedAt: move.completedAt?.toISOString() ?? null,
          }
        : null,
      registers: registers.map((register) => ({
        ...register,
        deliveredAt: move?.relocations[register.id]?.deliveredAt ?? null,
      })),
    });
  });
  app.post("/migration/move", async (c) => {
    const parsed = v.safeParse(cloudMoveBody, await c.req.json().catch(() => undefined));
    if (!parsed.success)
      return c.json({ error: "Enter the cloud address, starting with https://" }, 400);
    const moved = await requestCloudMove(
      database,
      commandContext(c.get("principal")),
      cloudMoves,
      parsed.output,
    );
    return c.json({ id: moved.moveId }, 202);
  });
  app.onError((error, c) => {
    if (error instanceof ImportError) return c.json({ error: error.message }, error.status);
    throw error;
  });
  return app;
}
