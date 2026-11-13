// An archive export is a Workflow: a snapshot of the org written as parts, then a signed seal. Whatever the cloud or
// the box does around it, the file a download assembles from the parts must verify and its counts must be the database's.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { boxBlobs } from "@shopper/adapters-box";
import { verifyChain } from "@shopper/audit";
import * as schema from "@shopper/db-pg";
import {
  archiveEntries,
  exportArchiveId,
  recordArchiveDownload,
  removeArchiveExport,
  runArchiveExport,
  startArchiveExport,
  verifyArchive,
  zipBytes,
} from "@shopper/export";
import type { Blobs } from "@shopper/ports";
import { exportFixture, storeAsset } from "../../support/export/org";

type Fixture = Awaited<ReturnType<typeof exportFixture>>;
let f: Fixture;
let dir: string;
let storage: Awaited<ReturnType<typeof boxBlobs>>["blobs"];
const actor = () => ({ ...f.ctx, actorId: f.userId });
let failPuts = 0;
const blobs: Blobs = {
  put: async (orgId, key, value) => {
    if (failPuts > 0 && key.endsWith("/tables/sale/0001.ndjson") && failPuts-- > 0)
      throw new Error("R2 is unavailable");
    return storage.put(orgId, key, value);
  },
  get: (...args) => storage.get(...args),
  createUpload: (...args) => storage.createUpload(...args),
  createDownload: (...args) => storage.createDownload(...args),
  delete: (...args) => storage.delete(...args),
  signedUrl: (...args) => storage.signedUrl(...args),
};

beforeAll(async () => {
  f = await exportFixture();
  dir = await mkdtemp(join(tmpdir(), "shopper-export-"));
  storage = (
    await boxBlobs(dir, { baseUrl: "http://127.0.0.1", secret: new Uint8Array(32).fill(3) })
  ).blobs;
  await storeAsset(f.db, storage, f.ctx.orgId, {
    key: "products/rice.png",
    purpose: "product_image",
  });
});
afterAll(async () => {
  await f?.close();
  if (dir) await rm(dir, { recursive: true, force: true });
});

/** Starts an export the way the API does, then runs its workflow with the engine's retries (`attempts` per step). */
async function exportOrg(orgId = f.ctx.orgId, attempts = 1) {
  const context = orgId === f.ctx.orgId ? actor() : f.other;
  const jobId = v7();
  const instanceId = exportArchiveId(orgId, jobId);
  await startArchiveExport(
    f.db,
    context,
    { jobId },
    {
      instanceId,
      businessKey: instanceId,
      type: "export-archive",
      step: "start",
      status: "running",
    },
  );
  const flow = {
    instanceId,
    step: async <T>(_name: string, _policy: unknown, run: () => Promise<T>) => {
      for (let attempt = 1; ; attempt++)
        try {
          return await run();
        } catch (error) {
          if (attempt >= attempts) throw error;
        }
    },
  };
  const deps = {
    withDatabase: <T>(run: (db: schema.ShopperDatabase) => Promise<T>) => run(f.db),
    blobs,
    appVersion: f.ctx.appVersion,
  };
  const done = await runArchiveExport(flow as never, deps, { orgId, jobId }).then(
    () => undefined,
    (error: unknown) => error as Error,
  );
  return { jobId, error: done };
}
const job = async (jobId: string) =>
  (await f.db.select().from(schema.exportJob).where(eq(schema.exportJob.id, jobId)))[0]!;

test("an export runs to ready: the assembled file verifies, its counts are the database's, its size is exact", async () => {
  const { jobId, error } = await exportOrg();
  expect(error).toBeUndefined();
  const row = await job(jobId);
  expect(row).toMatchObject({ status: "ready", requestedBy: f.userId, missingBlobs: 0 });
  const bytes = await zipBytes(await archiveEntries(blobs, f.ctx.orgId, jobId));
  expect(bytes.length).toBe(row.bytes);
  const result = await verifyArchive(bytes);
  if (!result.ok) throw new Error(result.message);
  expect(result.manifest.org).toMatchObject({
    id: f.ctx.orgId,
    slug: "kofi-mart",
    name: "Kofi Mart",
  });
  expect(result.manifest.blobs.map((b) => b.path)).toEqual(["blobs/products/rice.png"]);
  for (const table of ["sale", "sale_line", "product", "store", "org"])
    expect(result.manifest.tables[table]?.rows ?? 0, table).toBe(await f.count(table));
  // The seal's own audit row is written after the snapshot, so the archive holds the start but not the seal.
  expect(result.manifest.tables.audit_log!.rows).toBe((await f.count("audit_log")) - 1);
  expect(row.rows).toBeGreaterThan(0);
  expect(Object.keys(result.manifest.tables)).not.toContain("export_job");
  expect(Object.keys(result.manifest.tables)).not.toContain("archive_key");
  const [run] = await f.db
    .select()
    .from(schema.workflowRun)
    .where(eq(schema.workflowRun.instanceId, exportArchiveId(f.ctx.orgId, jobId)));
  expect(run).toMatchObject({ type: "export-archive", status: "completed" });
});

test("start and seal are audited with counts and names, and the chain still verifies", async () => {
  const rows = await f.db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, f.ctx.orgId))
    .orderBy(schema.auditLog.chainSeq);
  const starts = rows.filter((r) => r.command === "export.archive.start");
  const seals = rows.filter((r) => r.command === "export.archive.seal");
  expect(starts.length).toBeGreaterThan(0);
  expect(starts[0]).toMatchObject({ actorId: f.userId });
  expect(seals[0]!.payload).toMatchObject({ files: expect.any(Number), rows: expect.any(Number) });
  expect(JSON.stringify(seals[0]!.payload)).not.toContain("privateKey");
  expect(await verifyChain(rows)).toMatchObject({ valid: true });
});

test("a part that fails once is retried: one job, one archive, the same bytes", async () => {
  failPuts = 1;
  const { jobId, error } = await exportOrg(f.ctx.orgId, 2);
  expect(error).toBeUndefined();
  expect((await job(jobId)).status).toBe("ready");
  expect(failPuts).toBe(0);
  const result = await verifyArchive(
    await zipBytes(await archiveEntries(blobs, f.ctx.orgId, jobId)),
  );
  expect(result.ok).toBe(true);
});

test("every export of an org is signed by the org's key, and another org has its own", async () => {
  const [first, second] = await Promise.all([exportOrg(), exportOrg(f.other.orgId)]);
  const a = await verifyArchive(
    await zipBytes(await archiveEntries(blobs, f.ctx.orgId, first.jobId)),
  );
  const b = await verifyArchive(
    await zipBytes(await archiveEntries(blobs, f.other.orgId, second.jobId)),
  );
  if (!a.ok || !b.ok) throw new Error("expected both to verify");
  const keys = await f.db
    .select()
    .from(schema.archiveKey)
    .where(eq(schema.archiveKey.orgId, f.ctx.orgId));
  expect(keys).toHaveLength(1);
  expect(a.publicKey).toBe(keys[0]!.publicKey);
  expect(b.publicKey).not.toBe(a.publicKey);
  // The signing key is not in the archive, and neither is the other org.
  const text = new TextDecoder().decode(
    await zipBytes(await archiveEntries(blobs, f.ctx.orgId, first.jobId)),
  );
  expect(text).not.toContain(keys[0]!.privateKey);
});

test("only one archive is prepared at a time", async () => {
  const jobId = v7();
  const checkpoint = (id: string) => ({
    instanceId: exportArchiveId(f.ctx.orgId, id),
    businessKey: exportArchiveId(f.ctx.orgId, id),
    type: "export-archive",
    step: "start",
    status: "running" as const,
  });
  await startArchiveExport(f.db, actor(), { jobId }, checkpoint(jobId));
  const second = v7();
  await expect(
    startArchiveExport(f.db, actor(), { jobId: second }, checkpoint(second)),
  ).rejects.toThrow("An archive is already being prepared");
  await f.db
    .update(schema.exportJob)
    .set({ status: "failed" })
    .where(eq(schema.exportJob.id, jobId));
});

test("a failed export says why and leaves a failed workflow, not a half archive", async () => {
  failPuts = 5;
  const { jobId, error } = await exportOrg();
  failPuts = 0;
  expect(error?.message).toBe("R2 is unavailable");
  expect(await job(jobId)).toMatchObject({ status: "failed", error: "R2 is unavailable" });
  const [run] = await f.db
    .select()
    .from(schema.workflowRun)
    .where(and(eq(schema.workflowRun.instanceId, exportArchiveId(f.ctx.orgId, jobId))));
  expect(run!.status).toBe("failed");
  await expect(archiveEntries(blobs, f.ctx.orgId, jobId)).rejects.toThrow("not ready");
});

test("deleting an archive removes its parts, never the org's own files, and a running one cannot be deleted", async () => {
  const { jobId } = await exportOrg();
  const entries = await archiveEntries(blobs, f.ctx.orgId, jobId);
  const part = entries.find((e) => e.path.startsWith("tables/"))!;
  expect((await part.read()).length).toBe(part.bytes);
  await removeArchiveExport(f.db, actor(), { jobId, blobs });
  expect((await job(jobId)).status).toBe("deleted");
  await expect(part.read()).rejects.toThrow();
  expect(await storage.get(f.ctx.orgId, "products/rice.png")).not.toBeNull();
  const running = v7();
  await f.db.insert(schema.exportJob).values({ id: running, orgId: f.ctx.orgId });
  await expect(removeArchiveExport(f.db, actor(), { jobId: running, blobs })).rejects.toThrow(
    "still being prepared",
  );
  await f.db
    .update(schema.exportJob)
    .set({ status: "failed" })
    .where(eq(schema.exportJob.id, running));
});

test("a download is an audited command that names the archive", async () => {
  const { jobId } = await exportOrg();
  await recordArchiveDownload(f.db, actor(), { jobId });
  const [row] = await f.db
    .select()
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.orgId, f.ctx.orgId),
        eq(schema.auditLog.command, "export.archive.download"),
      ),
    );
  expect(row).toMatchObject({ actorId: f.userId, entityId: jobId, payload: { jobId } });
});
