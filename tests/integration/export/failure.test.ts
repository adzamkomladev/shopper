// When an export goes wrong, or is no longer wanted: the owner is told why, and nothing of the business is left in
// storage that they cannot reach to delete.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import {
  archiveEntries,
  exportArchiveId,
  recordArchiveDownload,
  removeArchiveExport,
} from "@shopper/export";
import { jobHarness } from "../../support/export/job";

let h: Awaited<ReturnType<typeof jobHarness>>;
beforeAll(async () => {
  h = await jobHarness();
});
afterAll(async () => h?.close());

test("a failed export says why and leaves a failed workflow, not a half archive", async () => {
  h.faults.failPuts = 5;
  const { jobId, error } = await h.exportOrg();
  h.faults.failPuts = 0;
  expect(error?.message).toBe("R2 is unavailable");
  expect(await h.job(jobId)).toMatchObject({ status: "failed", error: "R2 is unavailable" });
  const [run] = await h.f.db
    .select()
    .from(schema.workflowRun)
    .where(and(eq(schema.workflowRun.instanceId, exportArchiveId(h.f.ctx.orgId, jobId))));
  expect(run!.status).toBe("failed");
  await expect(archiveEntries(h.blobs, h.f.ctx.orgId, jobId)).rejects.toThrow("not ready");
  // The tables written before the failure are not left behind: the owner never sees this archive to delete it.
  for (const table of ["org", "product", "branch"])
    expect(
      await h.storage.get(h.f.ctx.orgId, `exports/${jobId}/tables/${table}/0001.ndjson`),
      table,
    ).toBeNull();
});

test("a failure after a complete dump leaves parts that Delete still removes", async () => {
  h.faults.failSeal = true;
  const { jobId, error } = await h.exportOrg();
  h.faults.failSeal = false;
  expect(error?.message).toBe("R2 is unavailable");
  const part = `exports/${jobId}/tables/org/0001.ndjson`;
  expect(await h.storage.get(h.f.ctx.orgId, part)).not.toBeNull();
  await removeArchiveExport(h.f.db, h.actor(), { jobId, blobs: h.blobs });
  expect(await h.storage.get(h.f.ctx.orgId, part)).toBeNull();
  expect(await h.storage.get(h.f.ctx.orgId, `exports/${jobId}/files.json`)).toBeNull();
});

test("deleting an archive removes its parts, never the org's own files, and a running one cannot be deleted", async () => {
  const { jobId } = await h.exportOrg();
  const entries = await archiveEntries(h.blobs, h.f.ctx.orgId, jobId);
  const part = entries.find((e) => e.path.startsWith("tables/"))!;
  expect((await part.read()).length).toBe(part.bytes);
  await removeArchiveExport(h.f.db, h.actor(), { jobId, blobs: h.blobs });
  expect((await h.job(jobId)).status).toBe("deleted");
  await expect(part.read()).rejects.toThrow();
  expect(await h.storage.get(h.f.ctx.orgId, "products/rice.png")).not.toBeNull();
  const running = v7();
  await h.f.db.insert(schema.exportJob).values({ id: running, orgId: h.f.ctx.orgId });
  await expect(
    removeArchiveExport(h.f.db, h.actor(), { jobId: running, blobs: h.blobs }),
  ).rejects.toThrow("still being prepared");
  await h.f.db
    .update(schema.exportJob)
    .set({ status: "failed" })
    .where(eq(schema.exportJob.id, running));
});

test("a download is an audited command that names the archive", async () => {
  const { jobId } = await h.exportOrg();
  await recordArchiveDownload(h.f.db, h.actor(), { jobId });
  const [row] = await h.f.db
    .select()
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.orgId, h.f.ctx.orgId),
        eq(schema.auditLog.command, "export.archive.download"),
      ),
    );
  expect(row).toMatchObject({ actorId: h.f.userId, entityId: jobId, payload: { jobId } });
});
