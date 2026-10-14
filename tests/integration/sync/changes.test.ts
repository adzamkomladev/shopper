import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";
import { v7 } from "uuid";
import { eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import * as schema from "@shopper/db-pg";
import { boxPriceChange, boxRealtime } from "@shopper/adapters-box";
import {
  archiveProduct,
  createProduct,
  runImport,
  schedulePrice,
  setPrice,
  updateProduct,
} from "@shopper/core/catalogue";
import { tillPrice, tillProduct } from "@shopper/core/schemas";
import { generateCatalogue, toSpreadsheet } from "../../../tooling/lib/catalogue/fixture";
import { loadRecordChanges, openFeed } from "../../support/till/feed";

let feed: Awaited<ReturnType<typeof openFeed>>;
beforeAll(async () => {
  feed = await openFeed();
});
afterAll(() => feed.close());

const keys = (entries: object) => Object.keys(entries).sort();
const draft = () => ({
  sku: `FEED-${v7()}`,
  name: "Feed product",
  baseUnit: "each",
  taxClass: "standard",
});
const seqs = (rows: { seq: string }[]) => rows.map((row) => BigInt(row.seq));

test("creating or updating a product writes one till-shaped upsert per store, after the last seq", async () => {
  const { context, orgId, stores } = await feed.world();
  const created = await createProduct(feed.db, context, draft());
  const rows = await feed.changes(orgId);
  expect(rows.map((row) => row.store_id).sort()).toEqual([...stores].sort());
  for (const row of rows) {
    expect(row).toMatchObject({ entity: "product", entity_id: created.id, op: "upsert", v: 2 });
    expect(BigInt(row.seq)).toBe(1n);
    expect(keys(row.payload)).toEqual(keys(tillProduct.entries));
    expect(row.payload).toMatchObject({ id: created.id, orgId, taxClass: "standard" });
  }
  expect(await feed.auditRows(orgId, "product.create")).toHaveLength(1);

  await updateProduct(feed.db, context, { id: created.id, data: { name: "Renamed" } });
  for (const storeId of stores) {
    const [, second] = await feed.changes(orgId, { storeId });
    expect(second).toMatchObject({ seq: "2", op: "upsert", payload: { name: "Renamed" } });
    expect(await feed.lastSeq(orgId, storeId)).toBe(2n);
  }
});

test("the product, its audit row and its feed rows roll back together", async () => {
  const { context, orgId, stores } = await feed.world();
  const product = draft();
  await expect(
    feed.db.transaction(async (tx) => {
      await createProduct(tx, context, product);
      throw new Error("abort after create");
    }),
  ).rejects.toThrow("abort after create");
  const found = await feed.db
    .select()
    .from(schema.product)
    .where(eq(schema.product.sku, product.sku));
  expect(found).toEqual([]);
  expect(await feed.auditRows(orgId, "product.create")).toEqual([]);
  expect(await feed.changes(orgId)).toEqual([]);
  expect(await feed.lastSeq(orgId, stores[0]!)).toBe(0n);
});

test("archiving a product emits an archived upsert to every store", async () => {
  const { context, orgId, stores } = await feed.world();
  const { id } = await createProduct(feed.db, context, draft());
  await archiveProduct(feed.db, context, { id });
  for (const storeId of stores) {
    const rows = await feed.changes(orgId, { storeId });
    expect(rows.map((row) => [row.seq, row.op, row.entity_id])).toEqual([
      ["1", "upsert", id],
      ["2", "upsert", id],
    ]);
    expect(rows[1]!.payload).toMatchObject({ archivedAt: expect.any(String) });
  }
});

test("a branch price reaches only its store and an org-wide price reaches all of them", async () => {
  const { context, orgId, stores, branchId } = await feed.world();
  const { id: productId } = await createProduct(feed.db, context, draft());
  const validFrom = "2026-01-01T00:00:00.000Z";
  await setPrice(feed.db, context, { productId, data: { amount: 8000, branchId, validFrom } });
  let rows = await feed.changes(orgId, { entity: "price" });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ store_id: stores[0], op: "upsert", v: 2 });
  expect(rows[0]!.payload).toMatchObject({
    productId,
    branchId,
    amount: 8000,
    validFrom,
    validTo: null,
  });

  await setPrice(feed.db, context, { productId, data: { amount: 9000, validFrom } });
  rows = (await feed.changes(orgId, { entity: "price" })).filter(
    (row) => (row.payload as { amount: number }).amount === 9000,
  );
  expect(rows.map((row) => row.store_id).sort()).toEqual([...stores].sort());
  expect(rows[0]!.payload).toMatchObject({ branchId: null, amount: 9000 });
  expect(Number.isInteger((rows[0]!.payload as { amount: number }).amount)).toBe(true);
});

test("a scheduled price window ends with a delete for that price in every store", async () => {
  const { context, orgId, stores } = await feed.world(2);
  const { id: productId } = await createProduct(feed.db, context, draft());
  const priceChange = boxPriceChange({ database: feed.db, realtime: boxRealtime() });
  const startsAt = new Date(Date.now() + 150).toISOString();
  const endsAt = new Date(Date.now() + 450).toISOString();
  const { price, workflowId } = await schedulePrice(feed.db, context, {
    productId,
    data: { amount: 7000, startsAt, endsAt },
    launch: (id, params) => priceChange.launcher.start(id, params),
  });
  const run = () =>
    feed.db.select().from(schema.workflowRun).where(eq(schema.workflowRun.instanceId, workflowId));
  await vi.waitFor(async () => expect(await run()).toMatchObject([{ status: "completed" }]), {
    timeout: 5000,
    interval: 25,
  });
  for (const storeId of stores) {
    const rows = (await feed.changes(orgId, { storeId, entity: "price" })).filter(
      (row) => row.entity_id === price.id,
    );
    expect(rows.at(-1)).toMatchObject({ op: "delete", v: 2 });
    expect(rows.filter((row) => row.op === "delete")).toHaveLength(1);
  }
});

test("payloads carry only the fields a till stores, never back-office ones", async () => {
  const { context, orgId } = await feed.world(1);
  const { id: productId } = await createProduct(feed.db, context, draft());
  const reason = `Secret supplier cost ${v7()}`;
  await setPrice(feed.db, { ...context, reason }, { productId, data: { amount: 5000 } });
  const [product, price] = await feed.changes(orgId);
  expect(keys(product!.payload)).toEqual(keys(tillProduct.entries));
  expect(keys(price!.payload)).toEqual(keys(tillPrice.entries));
  expect(JSON.stringify(await feed.changes(orgId))).not.toContain(reason);
  for (const hidden of ["reason", "cost", "categoryId", "supplierId", "onlineVisible"])
    expect(JSON.stringify(product!.payload) + JSON.stringify(price!.payload)).not.toContain(
      `"${hidden}"`,
    );
});

test("a command that throws after recordChanges leaves no rows, no burnt seq and no gap", async () => {
  const { context, orgId, stores } = await feed.world();
  const recordChanges = await loadRecordChanges();
  const change = () => [{ entity: "product", entityId: v7(), op: "upsert", payload: { n: 1 } }];
  const failing = defineCommand({
    name: "test.feed.fail",
    async run(tx, ctx, input: { storeIds: string[] }) {
      await recordChanges(tx, ctx.orgId, change(), input.storeIds);
      throw new Error("boom");
    },
    audit: () => ({}),
  });
  await expect(failing(feed.db, context, { storeIds: stores })).rejects.toThrow("boom");
  expect(await feed.changes(orgId)).toEqual([]);
  for (const storeId of stores) expect(await feed.lastSeq(orgId, storeId)).toBe(0n);

  await feed.db.transaction((tx) => recordChanges(tx, orgId, change(), stores));
  expect((await feed.changes(orgId)).map((row) => row.seq)).toEqual(["1", "1", "1"]);
});

test("concurrent multi-store calls in opposite store order neither deadlock nor overlap", async () => {
  const { orgId, stores } = await feed.world(3);
  const recordChanges = await loadRecordChanges();
  const calls = 12;
  await Promise.all(
    Array.from({ length: calls }, (_, call) =>
      feed.db.transaction((tx) =>
        recordChanges(
          tx,
          orgId,
          [1, 2].map((n) => ({
            entity: "product",
            entityId: v7(),
            op: "upsert",
            payload: { call, n },
          })),
          call % 2 ? stores : [...stores].reverse(),
        ),
      ),
    ),
  );
  for (const storeId of stores) {
    const rows = await feed.changes(orgId, { storeId });
    expect(seqs(rows)).toEqual(Array.from({ length: calls * 2 }, (_, i) => BigInt(i + 1)));
    expect(await feed.lastSeq(orgId, storeId)).toBe(BigInt(calls * 2));
    for (let call = 0; call < calls; call++) {
      const own = seqs(rows.filter((row) => (row.payload as { call: number }).call === call));
      expect(own).toHaveLength(2);
      expect(own[1]! - own[0]!).toBe(1n);
    }
  }
});

test("importing N products writes N product rows and one contiguous seq range per store", async () => {
  const { context, orgId, stores } = await feed.world();
  const count = 40;
  const bytes = toSpreadsheet(generateCatalogue(count, 3), "xlsx");
  const result = await runImport(feed.db, context, bytes, "feed.xlsx");
  expect(result).toMatchObject({ created: count, rowsFailed: 0 });
  for (const storeId of stores) {
    const rows = await feed.changes(orgId, { storeId });
    const products = rows.filter((row) => row.entity === "product");
    expect(products).toHaveLength(count);
    expect(new Set(products.map((row) => row.entity_id)).size).toBe(count);
    expect(new Set(products.map((row) => row.op))).toEqual(new Set(["upsert"]));
    const all = seqs(rows);
    expect(all[0]).toBe(1n);
    expect(all.at(-1)! - all[0]! + 1n).toBe(BigInt(all.length));
    expect(await feed.lastSeq(orgId, storeId)).toBe(BigInt(all.length));
  }
});
