import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { asc, eq } from "drizzle-orm";
import { verifyChain } from "@shopper/audit";
import { auditLog } from "@shopper/db-pg";
import {
  createBarcodeMapping,
  deleteBarcodeMapping,
  listBarcodeMappings,
  updateBarcodeMapping,
} from "@shopper/core/catalogue";
import { openFeed } from "../../../support/till/feed";
import { ghost, price, weight } from "./support";

let feed: Awaited<ReturnType<typeof openFeed>>;
beforeAll(async () => {
  feed = await openFeed();
});
afterAll(async () => feed?.close());

const entity = "barcode-mapping";
async function setup(stores = 2) {
  const world = await feed.world(stores);
  const context = { ...world.context, reason: "Mapping test" };
  const audit = (command: string) => feed.auditRows(world.orgId, command);
  const feedRows = () => feed.changes(world.orgId, { entity });
  const heads = async () => Promise.all(world.stores.map((s) => feed.lastSeq(world.orgId, s)));
  return { ...world, context, audit, feedRows, heads };
}

test("creating a mapping returns it, lists it, and writes one audit row and one feed row per store", async () => {
  const w = await setup(2);
  const created = await createBarcodeMapping(feed.db, w.context, weight());
  expect(created).toMatchObject({ id: expect.any(String), ...weight() });
  expect(await listBarcodeMappings(feed.db, w.orgId)).toEqual([expect.objectContaining(weight())]);

  const audit = await w.audit("barcode-mapping.create");
  expect(audit).toHaveLength(1);
  expect(audit[0]).toMatchObject({ entityId: created.id, actorId: w.context.actorId ?? null });
  expect(audit[0]!.before).toBeNull();
  expect(audit[0]!.after).toMatchObject(weight());

  const rows = await w.feedRows();
  expect(rows).toHaveLength(2);
  expect(rows.map((r) => r.store_id).sort()).toEqual([...w.stores].sort());
  for (const row of rows)
    expect(row).toMatchObject({ entity, entity_id: created.id, op: "upsert", v: 6 });
  expect(rows[0]!.payload).toMatchObject(weight());
});

test("updating a mapping audits before and after and feeds the new layout", async () => {
  const w = await setup(1);
  const created = await createBarcodeMapping(feed.db, w.context, weight());
  const updated = await updateBarcodeMapping(feed.db, w.context, {
    id: created.id,
    data: { decimals: 2, unit: "kg" },
  });
  expect(updated).toMatchObject({ id: created.id, ...weight({ decimals: 2, unit: "kg" }) });
  expect(await listBarcodeMappings(feed.db, w.orgId)).toEqual([updated]);

  const audit = await w.audit("barcode-mapping.update");
  expect(audit).toHaveLength(1);
  expect(audit[0]).toMatchObject({ entityId: created.id });
  expect(audit[0]!.before).toMatchObject({ decimals: 0, unit: "g" });
  expect(audit[0]!.after).toMatchObject({ decimals: 2, unit: "kg" });

  const rows = await w.feedRows();
  expect(rows.map((r) => r.op)).toEqual(["upsert", "upsert"]);
  expect(rows[1]!.payload).toMatchObject({ decimals: 2, unit: "kg" });
});

test("a layout changes kind both ways, and a price layout keeps no unit", async () => {
  const w = await setup(1);
  const created = await createBarcodeMapping(feed.db, w.context, weight());
  // The portal sends the whole layout, as a price layout has it: no unit.
  const { unit: _unit, ...layout } = weight({ decimals: 2 });
  const priced = await updateBarcodeMapping(feed.db, w.context, {
    id: created.id,
    data: { ...layout, kind: "price" },
  });
  expect(priced).toMatchObject({ id: created.id, kind: "price", decimals: 2 });
  expect(priced).not.toHaveProperty("unit");
  const weighed = await updateBarcodeMapping(feed.db, w.context, {
    id: created.id,
    data: { kind: "weight", unit: "kg" },
  });
  expect(weighed).toMatchObject({ kind: "weight", unit: "kg", decimals: 2 });
});

test("deleting a mapping removes it, audits the old layout and feeds a delete", async () => {
  const w = await setup(1);
  const created = await createBarcodeMapping(feed.db, w.context, price());
  await deleteBarcodeMapping(feed.db, w.context, { id: created.id });
  expect(await listBarcodeMappings(feed.db, w.orgId)).toEqual([]);

  const audit = await w.audit("barcode-mapping.delete");
  expect(audit).toHaveLength(1);
  expect(audit[0]).toMatchObject({ entityId: created.id });
  expect(audit[0]!.before).toMatchObject(price());
  expect(audit[0]!.after).toBeNull();

  const rows = await w.feedRows();
  expect(rows.map((r) => r.op)).toEqual(["upsert", "delete"]);
  expect(rows[1]).toMatchObject({ entity, entity_id: created.id });
});

test("the audit chain stays valid across mapping commands", async () => {
  const w = await setup(1);
  const created = await createBarcodeMapping(feed.db, w.context, weight());
  await updateBarcodeMapping(feed.db, w.context, { id: created.id, data: { decimals: 1 } });
  await deleteBarcodeMapping(feed.db, w.context, { id: created.id });
  const rows = await feed.db
    .select()
    .from(auditLog)
    .where(eq(auditLog.orgId, w.orgId))
    .orderBy(asc(auditLog.chainSeq));
  expect(await verifyChain(rows)).toMatchObject({ valid: true });
});

test("a failing command writes neither an audit row nor a feed row and keeps the feed head", async () => {
  const w = await setup(2);
  await createBarcodeMapping(feed.db, w.context, weight());
  const other = await createBarcodeMapping(feed.db, w.context, price());
  const heads = await w.heads();
  const failures = [
    () => createBarcodeMapping(feed.db, w.context, weight()), // prefix 21 is taken
    () => updateBarcodeMapping(feed.db, w.context, { id: other.id, data: { prefix: 21 } }),
    () => updateBarcodeMapping(feed.db, w.context, { id: ghost, data: { decimals: 1 } }),
    () => deleteBarcodeMapping(feed.db, w.context, { id: ghost }),
  ];
  for (const failure of failures) await expect(failure()).rejects.toThrow();

  expect(await w.heads()).toEqual(heads);
  expect(await w.feedRows()).toHaveLength(4); // two mappings on two stores
  expect(await w.audit("barcode-mapping.create")).toHaveLength(2);
  expect(await w.audit("barcode-mapping.update")).toHaveLength(0);
  expect(await w.audit("barcode-mapping.delete")).toHaveLength(0);
  expect(await listBarcodeMappings(feed.db, w.orgId)).toHaveLength(2);
});

test("a prefix conflict is a 409 and the same prefix is free in another organisation", async () => {
  const a = await setup(1);
  const b = await setup(1);
  await createBarcodeMapping(feed.db, a.context, weight());
  await expect(createBarcodeMapping(feed.db, a.context, weight())).rejects.toMatchObject({
    status: 409,
  });
  await expect(
    createBarcodeMapping(feed.db, a.context, price({ prefix: 21 })),
  ).rejects.toMatchObject({ status: 409 });
  expect(await createBarcodeMapping(feed.db, b.context, weight())).toMatchObject({ prefix: 21 });
  expect(await listBarcodeMappings(feed.db, a.orgId)).toHaveLength(1);
  expect(await listBarcodeMappings(feed.db, b.orgId)).toHaveLength(1);
});

test("another organisation's mapping cannot be updated or deleted and is not listed", async () => {
  const a = await setup(1);
  const b = await setup(1);
  const mine = await createBarcodeMapping(feed.db, a.context, weight());
  const missing = { status: 404 };
  await expect(
    updateBarcodeMapping(feed.db, b.context, { id: mine.id, data: { decimals: 3 } }),
  ).rejects.toMatchObject(missing);
  await expect(deleteBarcodeMapping(feed.db, b.context, { id: mine.id })).rejects.toMatchObject(
    missing,
  );
  expect(await listBarcodeMappings(feed.db, b.orgId)).toEqual([]);
  expect(await listBarcodeMappings(feed.db, a.orgId)).toEqual([mine]);
  expect(await b.feedRows()).toEqual([]);
});
