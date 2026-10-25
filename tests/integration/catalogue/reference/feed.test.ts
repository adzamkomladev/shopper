// Slice 2: every catalogue command that changes what a till can scan feeds a v2 row with the barcodes.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import {
  addBarcode,
  archiveProduct,
  createBarcodeMapping,
  createProduct,
  deleteBarcodeMapping,
  removeBarcode,
  runImport,
  updateBarcodeMapping,
  updateProduct,
} from "@shopper/core/catalogue";
import { openFeed, type FeedRow } from "../../../support/till/feed";

let feed: Awaited<ReturnType<typeof openFeed>>;
beforeAll(async () => {
  feed = await openFeed();
});
afterAll(async () => feed?.close());

type Barcode = { code: string; quantityThousandths: number };
const byCode = (list: Barcode[]) => [...list].sort((a, b) => a.code.localeCompare(b.code));
const barcodesOf = (row: FeedRow) =>
  byCode((row.payload as { barcodes?: Barcode[] }).barcodes ?? []);
const draft = (barcodes: Barcode[] = []) => ({
  sku: `REF-${v7()}`,
  name: "Reference product",
  baseUnit: "each",
  taxClass: "standard",
  barcodes,
});
/** A valid EAN-13 starting with zero, so a numeric cast anywhere on the way shows up. */
let serial = 0;
function ean13() {
  const body = `0590${String(++serial).padStart(8, "0")}`;
  const sum = body
    .split("")
    .reduce((total, digit, i) => total + Number(digit) * (i % 2 ? 3 : 1), 0);
  return `${body}${(10 - (sum % 10)) % 10}`;
}

async function setup(stores = 2) {
  const world = await feed.world(stores);
  const context = { ...world.context, reason: "Reference feed" };
  const rows = (entity: string) => feed.changes(world.orgId, { entity });
  /** The newest product row each store holds for `id`. */
  const latest = async (id: string) => {
    const all = (await rows("product")).filter((row) => row.entity_id === id);
    return world.stores.map((storeId) => all.filter((row) => row.store_id === storeId).at(-1)!);
  };
  const count = async (entity: string) => (await rows(entity)).length;
  return { ...world, context, rows, latest, count };
}

test("a created product feeds v2 with its barcodes, leading zeros and pack quantities intact", async () => {
  const w = await setup();
  const codes = [
    { code: "0012345", quantityThousandths: 1000 },
    { code: "00098765", quantityThousandths: 12_000 },
  ];
  const created = await createProduct(feed.db, w.context, draft(codes));
  const rows = await w.rows("product");
  expect(rows).toHaveLength(w.stores.length);
  for (const row of rows) {
    expect(row).toMatchObject({ entity_id: created.id, op: "upsert", v: 6 });
    expect(barcodesOf(row)).toEqual(byCode(codes));
  }
  const bare = await createProduct(feed.db, w.context, draft());
  for (const row of await w.latest(bare.id)) expect(row.payload).toMatchObject({ barcodes: [] });
  for (const row of await feed.changes(w.orgId)) expect(row.v, row.entity).toBe(6);
});

test("updating a product keeps its barcodes in the new row", async () => {
  const w = await setup(1);
  const codes = [{ code: "0000111", quantityThousandths: 1000 }];
  const created = await createProduct(feed.db, w.context, draft(codes));
  await updateProduct(feed.db, w.context, { id: created.id, data: { name: "Renamed" } });
  const [row] = await w.latest(created.id);
  expect(row).toMatchObject({ seq: "2", v: 6, payload: { name: "Renamed" } });
  expect(barcodesOf(row!)).toEqual(codes);
});

test("adding and removing a barcode each feed a fresh v2 product row to every store", async () => {
  const w = await setup();
  const created = await createProduct(feed.db, w.context, draft());
  await addBarcode(feed.db, w.context, { productId: created.id, data: { code: "0042" } });
  await addBarcode(feed.db, w.context, {
    productId: created.id,
    data: { code: "0099", quantityThousandths: 6000 },
  });
  expect(await w.count("product")).toBe(3 * w.stores.length);
  for (const row of await w.latest(created.id)) {
    expect(row).toMatchObject({ op: "upsert", v: 6 });
    expect(barcodesOf(row)).toEqual([
      { code: "0042", quantityThousandths: 1000 },
      { code: "0099", quantityThousandths: 6000 },
    ]);
  }
  await removeBarcode(feed.db, w.context, { productId: created.id, code: "0042" });
  expect(await w.count("product")).toBe(4 * w.stores.length);
  for (const row of await w.latest(created.id))
    expect(barcodesOf(row)).toEqual([{ code: "0099", quantityThousandths: 6000 }]);
});

const header = "SKU,Name,Barcodes,Pack Barcode,Pack Qty,Unit,Tax Class,Selling Price";
const sheet = (sku: string, barcodes: string, pack: string, qty: number) =>
  new TextEncoder().encode(`${header}\n${sku},Milo,${barcodes},${pack},${qty},each,Standard,5.50`);

test("an import that only adds a barcode or corrects a pack quantity still feeds the product", async () => {
  const w = await setup();
  const [single, extra, pack] = [ean13(), ean13(), ean13()];
  const sku = `IMP-${v7()}`;
  await runImport(feed.db, w.context, sheet(sku, single, pack, 12), "one.csv");
  const [first] = await w.rows("product");
  const id = first!.entity_id;
  expect(barcodesOf(first!)).toEqual(
    byCode([
      { code: single, quantityThousandths: 1000 },
      { code: pack, quantityThousandths: 12_000 },
    ]),
  );
  const prices = await w.count("price");

  await runImport(feed.db, w.context, sheet(sku, `${single};${extra}`, pack, 12), "two.csv");
  expect(await w.count("product"), "barcode-only change").toBe(2 * w.stores.length);
  expect(await w.count("price"), "same price, no price row").toBe(prices);
  for (const row of await w.latest(id)) {
    expect(row.v).toBe(6);
    expect(barcodesOf(row).map((b) => b.code)).toEqual([single, extra, pack].sort());
  }

  await runImport(feed.db, w.context, sheet(sku, `${single};${extra}`, pack, 24), "three.csv");
  expect(await w.count("product"), "pack quantity correction").toBe(3 * w.stores.length);
  for (const row of await w.latest(id))
    expect(barcodesOf(row)).toContainEqual({ code: pack, quantityThousandths: 24_000 });
});

test("archiving feeds the product with archivedAt and the barcodes it had", async () => {
  const w = await setup();
  const codes = [{ code: "0077", quantityThousandths: 1000 }];
  const created = await createProduct(feed.db, w.context, draft(codes));
  await archiveProduct(feed.db, w.context, { id: created.id });
  for (const row of await w.latest(created.id)) {
    expect(row).toMatchObject({ seq: "2", op: "upsert", v: 6 });
    expect(row.payload).toMatchObject({ archivedAt: expect.any(String) });
    expect(barcodesOf(row)).toEqual(codes);
  }
});

test("mapping create, update and delete feed v4 barcode-mapping rows to every store", async () => {
  const w = await setup();
  const layout = {
    prefix: 21,
    product: { start: 2, length: 5 },
    value: { start: 7, length: 5 },
    kind: "weight" as const,
    unit: "g" as const,
    decimals: 0,
  };
  const made = await createBarcodeMapping(feed.db, w.context, layout);
  await updateBarcodeMapping(feed.db, w.context, {
    id: made.id,
    data: { unit: "kg", decimals: 3 },
  });
  await deleteBarcodeMapping(feed.db, w.context, { id: made.id });
  for (const storeId of w.stores) {
    const rows = await feed.changes(w.orgId, { storeId, entity: "barcode-mapping" });
    expect(rows.map((row) => [row.op, row.v])).toEqual([
      ["upsert", 6],
      ["upsert", 6],
      ["delete", 6],
    ]);
    expect(rows[0]!.payload).toMatchObject(layout);
    expect(rows[1]!.payload).toMatchObject({ unit: "kg", decimals: 3 });
    expect(rows[2]!.payload).toEqual({ id: made.id });
  }
});
