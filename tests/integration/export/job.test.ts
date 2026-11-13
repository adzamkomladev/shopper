// An archive export is a Workflow: a snapshot of the org written as parts, then a signed seal. Whatever the cloud or
// the box does around it, the file a download assembles from the parts must verify and its counts must be the database's.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { verifyChain } from "@shopper/audit";
import * as schema from "@shopper/db-pg";
import {
  archiveEntries,
  exportArchiveId,
  startArchiveExport,
  verifyArchive,
  zipBytes,
} from "@shopper/export";
import { jobHarness } from "../../support/export/job";

let h: Awaited<ReturnType<typeof jobHarness>>;
beforeAll(async () => {
  h = await jobHarness();
});
afterAll(async () => h?.close());

test("an export runs to ready: the assembled file verifies, its counts are the database's, its size is exact", async () => {
  const { jobId, error } = await h.exportOrg();
  expect(error).toBeUndefined();
  const row = await h.job(jobId);
  expect(row).toMatchObject({ status: "ready", requestedBy: h.f.userId, missingBlobs: 0 });
  const bytes = await zipBytes(await archiveEntries(h.blobs, h.f.ctx.orgId, jobId));
  expect(bytes.length).toBe(row.bytes);
  const result = await verifyArchive(bytes);
  if (!result.ok) throw new Error(result.message);
  expect(result.manifest.org).toMatchObject({
    id: h.f.ctx.orgId,
    slug: "kofi-mart",
    name: "Kofi Mart",
  });
  expect(result.manifest.blobs.map((b) => b.path)).toEqual(["blobs/products/rice.png"]);
  for (const table of ["sale", "sale_line", "product", "store", "org"])
    expect(result.manifest.tables[table]?.rows ?? 0, table).toBe(await h.f.count(table));
  // The seal's own audit row is written after the snapshot, so the archive holds the start but not the seal.
  expect(result.manifest.tables.audit_log!.rows).toBe((await h.f.count("audit_log")) - 1);
  expect(row.rows).toBeGreaterThan(0);
  expect(Object.keys(result.manifest.tables)).not.toContain("export_job");
  expect(Object.keys(result.manifest.tables)).not.toContain("archive_key");
  const [run] = await h.f.db
    .select()
    .from(schema.workflowRun)
    .where(eq(schema.workflowRun.instanceId, exportArchiveId(h.f.ctx.orgId, jobId)));
  expect(run).toMatchObject({ type: "export-archive", status: "completed" });
});

test("start and seal are audited with counts and names, and the chain still verifies", async () => {
  const rows = await h.f.db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, h.f.ctx.orgId))
    .orderBy(schema.auditLog.chainSeq);
  const starts = rows.filter((r) => r.command === "export.archive.start");
  const seals = rows.filter((r) => r.command === "export.archive.seal");
  expect(starts.length).toBeGreaterThan(0);
  expect(starts[0]).toMatchObject({ actorId: h.f.userId });
  expect(seals[0]!.payload).toMatchObject({ files: expect.any(Number), rows: expect.any(Number) });
  expect(JSON.stringify(seals[0]!.payload)).not.toContain("privateKey");
  expect(await verifyChain(rows)).toMatchObject({ valid: true });
});

test("a part that fails once is retried: one job, one archive, the same bytes", async () => {
  h.faults.failPuts = 1;
  const { jobId, error } = await h.exportOrg(h.f.ctx.orgId, 2);
  expect(error).toBeUndefined();
  expect((await h.job(jobId)).status).toBe("ready");
  expect(h.faults.failPuts).toBe(0);
  const result = await verifyArchive(
    await zipBytes(await archiveEntries(h.blobs, h.f.ctx.orgId, jobId)),
  );
  expect(result.ok).toBe(true);
});

test("every export of an org is signed by the org's key, and another org has its own", async () => {
  const [first, second] = await Promise.all([h.exportOrg(), h.exportOrg(h.f.other.orgId)]);
  const a = await verifyArchive(
    await zipBytes(await archiveEntries(h.blobs, h.f.ctx.orgId, first.jobId)),
  );
  const b = await verifyArchive(
    await zipBytes(await archiveEntries(h.blobs, h.f.other.orgId, second.jobId)),
  );
  if (!a.ok || !b.ok) throw new Error("expected both to verify");
  const keys = await h.f.db
    .select()
    .from(schema.archiveKey)
    .where(eq(schema.archiveKey.orgId, h.f.ctx.orgId));
  expect(keys).toHaveLength(1);
  expect(a.publicKey).toBe(keys[0]!.publicKey);
  expect(b.publicKey).not.toBe(a.publicKey);
  // The signing key is not in the archive, and neither is the other org.
  const text = new TextDecoder().decode(
    await zipBytes(await archiveEntries(h.blobs, h.f.ctx.orgId, first.jobId)),
  );
  expect(text).not.toContain(keys[0]!.privateKey);
});

test("only one archive is prepared at a time", async () => {
  const jobId = v7();
  await startArchiveExport(h.f.db, h.actor(), { jobId }, h.checkpoint(h.f.ctx.orgId, jobId));
  const second = v7();
  await expect(
    startArchiveExport(h.f.db, h.actor(), { jobId: second }, h.checkpoint(h.f.ctx.orgId, second)),
  ).rejects.toThrow("An archive is already being prepared");
  await h.f.db
    .update(schema.exportJob)
    .set({ status: "failed" })
    .where(eq(schema.exportJob.id, jobId));
});
