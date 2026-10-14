import { expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { asset, auditLog } from "@shopper/db-pg";
import { api, blobs, context, databases } from "../../support/till/server";
import { sha256 } from "@shopper/utils";
import { pullHeaders } from "../../support/till/pull";

test("generated snapshots are private tracked assets and repeated reads reuse the asset audit", async () => {
  const response = await api.request("/sync/snapshot", { headers: pullHeaders() });
  expect(response.status).toBe(200);
  const { db } = databases();
  const records = await db
    .select()
    .from(asset)
    .where(and(eq(asset.orgId, context.orgId), eq(asset.purpose, "sync_snapshot")));
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    bucket: "snapshots",
    visibility: "private",
    contentType: "application/gzip",
    expiresAt: null,
  });
  const audits = () => db.select().from(auditLog).where(eq(auditLog.entityId, records[0]!.id));
  expect(await audits()).toHaveLength(1);
  expect((await api.request("/sync/snapshot", { headers: pullHeaders() })).status).toBe(200);
  expect(await audits()).toHaveLength(1);
});

test("a lost snapshot is restored under its existing asset and the repair is audited once", async () => {
  expect((await api.request("/sync/snapshot", { headers: pullHeaders() })).status).toBe(200);
  const { db } = databases();
  const [saved] = await db
    .select()
    .from(asset)
    .where(and(eq(asset.orgId, context.orgId), eq(asset.purpose, "sync_snapshot")));
  await blobs.delete(context.orgId, saved!.key);
  expect(await blobs.get(context.orgId, saved!.key)).toBeNull();
  const repaired = await api.request("/sync/snapshot", { headers: pullHeaders() });
  expect(repaired.status).toBe(200);
  const bytes = await blobs.get(context.orgId, saved!.key);
  expect(bytes).not.toBeNull();
  const records = await db
    .select()
    .from(asset)
    .where(and(eq(asset.orgId, context.orgId), eq(asset.purpose, "sync_snapshot")));
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    id: saved!.id,
    sizeBytes: bytes!.length,
    sha256: await sha256(bytes!),
  });
  const audits = () => db.select().from(auditLog).where(eq(auditLog.entityId, saved!.id));
  expect(await audits()).toHaveLength(2);
  expect((await api.request("/sync/snapshot", { headers: pullHeaders() })).status).toBe(200);
  expect(await audits()).toHaveLength(2);
});
