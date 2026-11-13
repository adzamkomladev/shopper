import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { boxBlobs } from "@shopper/adapters-box";
import * as schema from "@shopper/db-pg";
import { exportArchiveId, runArchiveExport, startArchiveExport } from "@shopper/export";
import type { Blobs } from "@shopper/ports";
import { exportFixture, storeAsset } from "./org";

/**
 * An org with an uploaded file, real blobs on disk with switches that make a put fail, and `exportOrg`, which starts
 * an export the way the API does and runs its workflow with the engine's retries (`attempts` per step).
 */
export async function jobHarness() {
  const f = await exportFixture();
  const dir = await mkdtemp(join(tmpdir(), "shopper-export-"));
  const storage = (
    await boxBlobs(dir, { baseUrl: "http://127.0.0.1", secret: new Uint8Array(32).fill(3) })
  ).blobs;
  await storeAsset(f.db, storage, f.ctx.orgId, {
    key: "products/rice.png",
    purpose: "product_image",
  });
  const faults = { failPuts: 0, failSeal: false };
  const blobs: Blobs = {
    put: async (orgId, key, value) => {
      if (faults.failPuts > 0 && key.endsWith("/tables/sale/0001.ndjson") && faults.failPuts-- > 0)
        throw new Error("R2 is unavailable");
      if (faults.failSeal && key.endsWith("/manifest.json")) throw new Error("R2 is unavailable");
      return storage.put(orgId, key, value);
    },
    get: (...args) => storage.get(...args),
    createUpload: (...args) => storage.createUpload(...args),
    createDownload: (...args) => storage.createDownload(...args),
    delete: (...args) => storage.delete(...args),
    signedUrl: (...args) => storage.signedUrl(...args),
  };
  const actor = () => ({ ...f.ctx, actorId: f.userId });
  const checkpoint = (orgId: string, jobId: string) => ({
    instanceId: exportArchiveId(orgId, jobId),
    businessKey: exportArchiveId(orgId, jobId),
    type: "export-archive",
    step: "start",
    status: "running" as const,
  });
  async function exportOrg(orgId = f.ctx.orgId, attempts = 1) {
    const context = orgId === f.ctx.orgId ? actor() : f.other;
    const jobId = v7();
    await startArchiveExport(f.db, context, { jobId }, checkpoint(orgId, jobId));
    const flow = {
      instanceId: exportArchiveId(orgId, jobId),
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
    const error = await runArchiveExport(flow as never, deps, { orgId, jobId }).then(
      () => undefined,
      (failure: unknown) => failure as Error,
    );
    return { jobId, error };
  }
  return {
    f,
    storage,
    blobs,
    faults,
    actor,
    checkpoint,
    exportOrg,
    job: async (jobId: string) =>
      (await f.db.select().from(schema.exportJob).where(eq(schema.exportJob.id, jobId)))[0]!,
    close: async () => {
      await f.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
