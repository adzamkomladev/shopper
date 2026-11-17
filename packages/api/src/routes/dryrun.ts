import { Hono } from "hono";
import * as v from "valibot";
import type { ShopperDatabase } from "@shopper/db-pg";
import { dryRunResult, requestArchiveExport } from "@shopper/export";
import type { Blobs, WorkflowLauncher } from "@shopper/ports";
import { commandContext } from "./stock/context";
import { problem } from "../middleware/problem";
import { dryRunId } from "../schemas/migration";
import { requireOrgWide } from "../middleware/require/branches";
import { requirePermission } from "../middleware/require/permission";
import type { ApiAuthentication, ApiEnvironment } from "../types";

/**
 * A move's dry run (migration.run, either direction): seal the archive the move would carry with nothing frozen, then
 * read it back as the other side will and say how long the move would keep the shop closed.
 */
export function dryRunRoutes(options: {
  database: ShopperDatabase;
  authentication?: ApiAuthentication;
  archiveExports: WorkflowLauncher;
  blobs: Blobs;
}) {
  const app = new Hono<ApiEnvironment>();
  const guard = [
    requirePermission(options.authentication, "migration.run"),
    requireOrgWide,
  ] as const;
  app.use("/migration/dryrun", ...guard).use("/migration/dryrun/*", ...guard);
  app.post("/migration/dryrun", async (c) => {
    const sealed = await requestArchiveExport(
      options.database,
      commandContext(c.get("principal")),
      options.archiveExports,
    );
    return c.json({ exportJobId: sealed.id }, 202);
  });
  app.get("/migration/dryrun/:id", async (c) => {
    const result = v.is(dryRunId, c.req.param("id"))
      ? await dryRunResult(options.database, options.blobs, {
          orgId: c.get("principal").orgId,
          id: c.req.param("id"),
        })
      : undefined;
    if (!result) return c.json({ error: "No such dry run." }, 404);
    return c.json(result);
  });
  app.onError(problem);
  return app;
}
