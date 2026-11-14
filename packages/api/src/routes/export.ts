import { Hono, type Context } from "hono";
import {
  archiveEntries,
  entityNames,
  exportEntity,
  getArchiveExport,
  listArchiveExports,
  rangedEntities,
  recordArchiveDownload,
  removeArchiveExport,
  requestArchiveExport,
  ExportError,
  zipLength,
  zipStream,
} from "@shopper/export";
import type { ShopperDatabase } from "@shopper/db-pg";
import { commandContext } from "./stock/context";
import { problem } from "../middleware/problem";
import { requireOrgWide } from "../middleware/require/branches";
import { requirePermission } from "../middleware/require/permission";
import type { ApiAuthentication, ApiEnvironment, ApiOptions } from "../types";

/**
 * Taking the business's data out (export.run): each entity as CSV or Excel, and the Shopper Archive, a signed copy of
 * every table the business owns. An archive is made by a workflow; the file is streamed from its stored parts.
 */
export function exportRoutes(
  database: ShopperDatabase,
  authentication: ApiAuthentication | undefined,
  options: Pick<ApiOptions, "archiveExports" | "blobs">,
) {
  const app = new Hono<ApiEnvironment>();
  // A copy of the whole business is for someone who works at every branch, whatever role they hold.
  app.use("/export/*", requirePermission(authentication, "export.run"), requireOrgWide);
  const context = (c: Context<ApiEnvironment>) => commandContext(c.get("principal"));
  const org = (c: Context<ApiEnvironment>) => c.get("principal").orgId;
  const blobs = () => {
    if (!options.blobs || !options.archiveExports)
      throw new ExportError("not_ready", "Full archives are not available here.");
    return options.blobs;
  };

  app.get("/export/entities", (c) =>
    c.json(entityNames.map((name) => ({ name, ranged: rangedEntities.includes(name) }))),
  );
  // /export/entities/sales.csv?from=&to= : the extension picks the format.
  app.get("/export/entities/:file", async (c) => {
    const [entity, format] = c.req.param("file").split(".");
    // Only the range comes from the caller: the page size and the Excel cap are the server's.
    const { from, to } = c.req.query();
    const file = await exportEntity(database, context(c), { entity, format, from, to } as never);
    return new Response(file.body as BodyInit, {
      headers: {
        "content-type": file.contentType,
        "content-disposition": `attachment; filename="${file.filename}"`,
      },
    });
  });

  app.get("/export/archives", async (c) => c.json(await listArchiveExports(database, org(c))));
  app.post("/export/archives", async (c) => {
    blobs();
    return c.json(await requestArchiveExport(database, context(c), options.archiveExports!), 202);
  });
  app.get("/export/archives/:id", async (c) => {
    const job = await getArchiveExport(database, org(c), c.req.param("id"));
    if (!job) throw new ExportError("not_found", "No such archive.");
    return c.json(job);
  });
  app.get("/export/archives/:id/download", async (c) => {
    const store = blobs();
    const job = await getArchiveExport(database, org(c), c.req.param("id"));
    if (!job) throw new ExportError("not_found", "No such archive.");
    if (job.status !== "ready") throw new ExportError("not_ready", "This archive is not ready.");
    const entries = await archiveEntries(store, org(c), job.id);
    await recordArchiveDownload(database, context(c), { jobId: job.id });
    return new Response(zipStream(entries), {
      headers: {
        "content-type": "application/zip",
        "content-length": String(zipLength(entries)),
        "content-disposition": `attachment; filename="shopper-archive-${job.createdAt.toISOString().slice(0, 10)}.shopper"`,
      },
    });
  });
  app.delete("/export/archives/:id", async (c) => {
    const removed = await removeArchiveExport(database, context(c), {
      jobId: c.req.param("id"),
      blobs: blobs(),
    });
    return c.json({ id: removed.jobId });
  });
  app.onError(problem);
  return app;
}
