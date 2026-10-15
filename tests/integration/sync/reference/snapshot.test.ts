import { gunzipSync } from "node:zlib";
// Slice 2: the cloud snapshot is v2, with barcodes inside each product and the org's embedded layouts.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { v7 } from "uuid";
import { boxBlobs } from "@shopper/adapters-box";
import { buildSnapshot } from "@shopper/core/changes";
import { archiveProduct, createBarcodeMapping, createProduct } from "@shopper/core/catalogue";
import { openFeed } from "../../../support/till/feed";

let feed: Awaited<ReturnType<typeof openFeed>>;
let directory: string;
let blobs: Awaited<ReturnType<typeof boxBlobs>>["blobs"];
beforeAll(async () => {
  feed = await openFeed();
  directory = await mkdtemp(join(tmpdir(), "shopper-reference-snapshot-"));
  blobs = (
    await boxBlobs(directory, {
      baseUrl: "https://shopper.test/blobs",
      secret: new Uint8Array(32).fill(5),
    })
  ).blobs;
});
afterAll(async () => {
  await feed?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

type Snapshot = {
  v: number;
  orgId: string;
  storeId: string;
  reference: {
    products: { id: string; barcodes: { code: string; quantityThousandths: number }[] }[];
    barcodeMappings: Record<string, unknown>[];
  };
};
const draft = (barcodes: { code: string; quantityThousandths?: number }[] = []) => ({
  sku: `SNAP-${v7()}`,
  name: "Snapshot product",
  baseUnit: "each",
  taxClass: "standard",
  barcodes,
});
const weight = (prefix: number) => ({
  prefix,
  product: { start: 2, length: 5 },
  value: { start: 7, length: 5 },
  kind: "weight" as const,
  unit: "g" as const,
  decimals: 0,
});

async function snapshotOf(world: Awaited<ReturnType<typeof feed.world>>) {
  const context = { ...world.context, reason: "Reference snapshot" };
  const bytes = await buildSnapshot(
    feed.db,
    blobs,
    { orgId: world.orgId, storeId: world.stores[0]! },
    context,
  );
  return JSON.parse(gunzipSync(bytes).toString()) as Snapshot;
}

test("the snapshot is v2 and every active product carries its barcodes", async () => {
  const world = await feed.world(1);
  const context = { ...world.context, reason: "Reference snapshot" };
  const packed = await createProduct(
    feed.db,
    context,
    draft([{ code: "0012345" }, { code: "00098765", quantityThousandths: 12_000 }]),
  );
  const bare = await createProduct(feed.db, context, draft());
  const gone = await createProduct(feed.db, context, draft([{ code: "0055555" }]));
  await archiveProduct(feed.db, context, { id: gone.id });

  const snapshot = await snapshotOf(world);
  expect(snapshot).toMatchObject({ v: 2, orgId: world.orgId, storeId: world.stores[0] });
  const products = new Map(snapshot.reference.products.map((row) => [row.id, row]));
  expect([...products.keys()].sort()).toEqual([packed.id, bare.id].sort());
  expect(
    [...products.get(packed.id)!.barcodes].sort((a, b) => a.code.localeCompare(b.code)),
  ).toEqual([
    { code: "00098765", quantityThousandths: 12_000 },
    { code: "0012345", quantityThousandths: 1000 },
  ]);
  expect(products.get(bare.id)!.barcodes).toEqual([]);
});

test("the snapshot lists the organisation's barcode mappings", async () => {
  const world = await feed.world(1);
  const context = { ...world.context, reason: "Reference snapshot" };
  expect((await snapshotOf(world)).reference.barcodeMappings).toEqual([]);
  const made = await createBarcodeMapping(feed.db, context, weight(21));
  await createBarcodeMapping(feed.db, context, { ...weight(22), unit: "kg", decimals: 3 });
  const { barcodeMappings } = (await snapshotOf(world)).reference;
  expect(barcodeMappings).toHaveLength(2);
  expect(barcodeMappings).toContainEqual(expect.objectContaining({ id: made.id, ...weight(21) }));
  expect(barcodeMappings).toContainEqual(
    expect.objectContaining({ prefix: 22, unit: "kg", decimals: 3 }),
  );
});

test("another organisation's products, barcodes and mappings never appear", async () => {
  const mine = await feed.world(1);
  const theirs = await feed.world(1);
  const secret = "0099990000";
  const foreign = await createProduct(
    feed.db,
    { ...theirs.context, reason: "Other org" },
    draft([{ code: secret }]),
  );
  await createBarcodeMapping(feed.db, { ...theirs.context, reason: "Other org" }, weight(25));
  await createProduct(
    feed.db,
    { ...mine.context, reason: "My org" },
    draft([{ code: "0011110000" }]),
  );

  const snapshot = await snapshotOf(mine);
  const text = JSON.stringify(snapshot);
  expect(text).not.toContain(foreign.id);
  expect(text).not.toContain(secret);
  expect(snapshot.reference.barcodeMappings).toEqual([]);
  await expect(
    buildSnapshot(
      feed.db,
      blobs,
      { orgId: mine.orgId, storeId: theirs.stores[0]! },
      { ...mine.context, reason: "Cross tenant" },
    ),
  ).rejects.toThrow("Store outside tenant scope");
});
