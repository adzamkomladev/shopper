import { Hono } from "hono";
import * as v from "valibot";
import { eq } from "drizzle-orm";
import { device, type ShopperDatabase } from "@shopper/db-pg";
import {
  cancelOnPremMove,
  getOnPremMove,
  ImportError,
  preflight,
  issueMoveLicence,
  moveLicenceBody,
  startOnPremMove,
} from "@shopper/export";
import type { WorkflowLauncher } from "@shopper/ports";
import { commandContext } from "./stock/context";
import { requireOrgWide } from "../middleware/require/branches";
import { requirePermission } from "../middleware/require/permission";
import type { ApiAuthentication, ApiEnvironment } from "../types";

/**
 * The cloud's "Move on-prem" (migration.run, cloud only): start the move (the org freezes and its archive seals),
 * issue the box's licence from the request code it shows, follow the box's report and the registers, or call it off.
 */
export function onPremRoutes(options: {
  database: ShopperDatabase;
  authentication?: ApiAuthentication;
  archiveExports: WorkflowLauncher;
  licenceSigningKey: string;
}) {
  const db = options.database;
  const app = new Hono<ApiEnvironment>();
  const guard = [
    requirePermission(options.authentication, "migration.run"),
    requireOrgWide,
  ] as const;
  app.use("/migration/onprem", ...guard).use("/migration/onprem/*", ...guard);
  app.get("/migration/onprem", async (c) => {
    const orgId = c.get("principal").orgId;
    const move = await getOnPremMove(db, orgId);
    const registers = await db
      .select({ id: device.id, name: device.name })
      .from(device)
      .where(eq(device.orgId, orgId))
      .orderBy(device.name);
    return c.json({
      move: move
        ? {
            id: move.id,
            status: move.status,
            archive: move.archive,
            exportJobId: move.exportJobId,
            licence: move.licence,
            boxUpstream: move.boxUpstream,
            report: move.report,
            startedAt: move.createdAt.toISOString(),
            completedAt: move.completedAt?.toISOString() ?? null,
          }
        : null,
      checks: await preflight(db, orgId),
      registers: registers.map((register) => ({
        ...register,
        deliveredAt: move?.relocations[register.id]?.deliveredAt ?? null,
      })),
    });
  });
  app.post("/migration/onprem", async (c) =>
    c.json(
      await startOnPremMove(db, commandContext(c.get("principal")), options.archiveExports),
      202,
    ),
  );
  app.post("/migration/onprem/licence", async (c) => {
    const parsed = v.safeParse(moveLicenceBody, await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json({ error: "Paste the request code your box shows" }, 400);
    const licence = await issueMoveLicence(db, commandContext(c.get("principal")), {
      issuerKey: options.licenceSigningKey,
      request: parsed.output.request,
    });
    return c.json(licence, 201);
  });
  app.delete("/migration/onprem", async (c) =>
    c.json(await cancelOnPremMove(db, commandContext(c.get("principal")), {})),
  );
  app.onError((error, c) => {
    if (error instanceof ImportError) return c.json({ error: error.message }, error.status);
    throw error;
  });
  return app;
}
