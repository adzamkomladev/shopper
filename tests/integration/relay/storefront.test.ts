// v1.5 Day 48: a relay shop's storefront looks like a cloud shop's. Product photos go to the relay content-addressed,
// straight to storage and once per digest; each branch's pickup, delivery, hours and slots come from the box.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { boxBlobs, boxRelayPublisher } from "@shopper/adapters-box";
import { createProduct, setPrice, updateProduct } from "@shopper/core/catalogue";
import { listSlots, saveFulfilment } from "@shopper/core/orders";
import { relayProjection } from "@shopper/core/relay";
import { createShopAccess } from "@shopper/core/shop";
import { sha256 } from "@shopper/utils";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { listKeys, rustfs } from "../../../tooling/storage/buckets";
import { fileBucket } from "../../support/assets/buckets";
import { emptyDatabase } from "../../support/migration/archive";
import { db as cloudDb } from "../auth/setup";
import { CLOUD, enrol, relayCloud, type Box } from "./support";

const LINK = "relay-storefront-link-secret-0123456789";
const cloudBucket = fileBucket();
const boxBucket = fileBucket();
const blobsIn = async (bucket: Promise<string>) =>
  (
    await boxBlobs(".shopper/test-blobs", {
      baseUrl: "https://shopper.test/blobs",
      secret: new Uint8Array(32).fill(5),
      receiptsObjectStorage: { ...rustfs, bucket: await bucket },
    })
  ).blobs;

let cloud: Awaited<ReturnType<typeof relayCloud>>;
let box: Awaited<ReturnType<typeof emptyDatabase>>;
let boxStorage: Awaited<ReturnType<typeof blobsIn>>;
let shop: Box;
let ctx: ReturnType<typeof provisioningContext>;
let slug: string;
const branches: string[] = [];
const products: string[] = [];
const rice = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
const milo = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 9, 8, 7, 6]);
/** Every image offer the relay answered, and whether it handed out an upload grant. */
const offers: boolean[] = [];

beforeAll(async () => {
  const blobs = await blobsIn(cloudBucket);
  const shopAccess = createShopAccess({ database: cloudDb, linkSecret: LINK, appVersion: "test" });
  cloud = await relayCloud({
    blobs,
    shop: { access: shopAccess, appVersion: "test", blobs, linkSecret: LINK },
  });
  boxStorage = await blobsIn(boxBucket);
  shop = await cloud.box();
  await enrol(shop);
  box = await emptyDatabase();
  ctx = provisioningContext(shop.licence.org);
  await provisionOrg(box.db, ctx, { name: "Osu Mart", slug: `osu-${Date.now().toString(36)}` });
  const storeId = v7();
  await box.db.insert(schema.store).values({ id: storeId, orgId: ctx.orgId, name: "Osu" });
  for (const name of ["Osu Main", "Osu Annex"]) {
    const id = v7();
    await box.db.insert(schema.branch).values({ id, orgId: ctx.orgId, storeId, name });
    branches.push(id);
  }
  // Two products share the rice photo's bytes (two box assets, one digest); a third has its own.
  for (const [index, bytes] of [rice, rice, milo].entries()) {
    const { id } = await createProduct(box.db, ctx, {
      sku: `PHOTO-${index}`,
      name: `Photo ${index}`,
      baseUnit: "each",
      taxClass: "standard",
      onlineVisible: true,
    });
    await setPrice(box.db, ctx, { productId: id, data: { amount: 12_000 } });
    const assetId = v7();
    const key = `receipts/products/${assetId}`;
    await boxStorage.put(ctx.orgId, key, bytes);
    await box.db.insert(schema.asset).values({
      id: assetId,
      orgId: ctx.orgId,
      purpose: "product_image",
      visibility: "private",
      bucket: "receipts",
      key,
      fileName: "photo.png",
      contentType: "image/png",
      sizeBytes: bytes.length,
      sha256: await sha256(bytes),
    });
    await box.db
      .update(schema.product)
      .set({ imageAssetId: assetId })
      .where(eq(schema.product.id, id));
    products.push(id);
  }
  await box.db.update(schema.org).set({ onlineOrders: true }).where(eq(schema.org.id, ctx.orgId));
  slug = (
    await cloudDb
      .select({ slug: schema.org.slug })
      .from(schema.org)
      .where(eq(schema.org.id, ctx.orgId))
  )[0]!.slug;
}, 180_000);
afterAll(async () => box?.close());

const publish = async () => {
  const flows = boxRelayPublisher({
    withDatabase: (run) => run(box.db),
    appVersion: ctx.appVersion,
    blobs: async () => boxStorage,
    send: async (path, init) => {
      const response = await cloud.send(shop, path, init);
      if (path === "/relay/images" && response.ok)
        offers.push("upload" in ((await response.clone().json()) as object));
      return response;
    },
  });
  await flows.start(ctx.orgId, { orgId: ctx.orgId });
  await flows.idle();
};
const shopGet = (path: string) => cloud.api.fetch(new Request(`${CLOUD}/shop/${slug}${path}`));
const relayImages = () =>
  cloudDb
    .select()
    .from(schema.asset)
    .where(and(eq(schema.asset.orgId, ctx.orgId), eq(schema.asset.purpose, "product_image")));

test("the same photo published twice is one object on the relay, and the store shows it", async () => {
  await publish();
  expect(await relayProjection(cloudDb, ctx.orgId)).toEqual(
    await relayProjection(box.db, ctx.orgId),
  );
  // One grant per digest, one asset row and one stored object per digest.
  expect(offers.filter(Boolean)).toHaveLength(2);
  expect(await relayImages()).toHaveLength(2);
  expect(await listKeys(await cloudBucket)).toHaveLength(2);
  const pages = await Promise.all(
    products.map(
      async (id) =>
        (await (await shopGet(`/products/${id}`)).json()) as {
          product: { imageAssetId: string | null };
        },
    ),
  );
  const [first, second, third] = pages.map((page) => page.product.imageAssetId);
  expect(first).toBeTruthy();
  expect(second).toBe(first);
  expect(third).not.toBe(first);
  const photo = await shopGet(`/images/${first}`);
  expect(photo.status).toBe(302);
  const bytes = new Uint8Array(await (await fetch(photo.headers.get("location")!)).arrayBuffer());
  expect(bytes).toEqual(rice);
  // A renamed product goes up again, its photo does not.
  await updateProduct(box.db, ctx, { id: products[0]!, data: { name: "Rice 5kg" } });
  const asked = offers.length;
  await publish();
  expect(offers.slice(asked).some(Boolean)).toBe(false);
  expect(await listKeys(await cloudBucket)).toHaveLength(2);
  expect(await relayImages()).toHaveLength(2);
});

const hours = (open: string, close: string, pickup = true) => ({
  pickup,
  delivery: false,
  deliveryFee: 0,
  opens: open,
  closes: close,
  slotMinutes: 60,
  slotCapacity: 5,
  leadMinutes: 0,
});
const slotsAt = async (branch: string) =>
  (await (await shopGet(`/fulfilment?branch=${branch}`)).json()) as Awaited<
    ReturnType<typeof listSlots>
  >;

test("the store's closed hours are respected on the relay's storefront", async () => {
  await saveFulfilment(box.db, ctx, { branchId: branches[0]!, values: hours("10:00", "12:00") });
  await saveFulfilment(box.db, ctx, { branchId: branches[1]!, values: hours("08:00", "20:00") });
  await publish();
  await saveFulfilment(box.db, ctx, {
    branchId: branches[1]!,
    values: hours("08:00", "20:00", false),
  });
  await publish();
  const open = await slotsAt(branches[0]!);
  expect(open.pickup).toBe(true);
  expect(open.slots).toEqual((await listSlots(box.db, ctx.orgId, branches[0]!)).slots);
  expect(open.slots.length).toBeGreaterThan(0);
  for (const slot of open.slots) expect(slot.start.slice(11, 16)).toMatch(/^1[01]:00$/);
  // A branch the box closed to online orders is closed online too.
  expect(await slotsAt(branches[1]!)).toMatchObject({ pickup: false, delivery: false });
  // New hours on the box are the relay's hours after the next publish.
  await saveFulfilment(box.db, ctx, { branchId: branches[0]!, values: hours("14:00", "15:00") });
  await publish();
  for (const slot of (await slotsAt(branches[0]!)).slots)
    expect(slot.start.slice(11, 16)).toBe("14:00");
  expect(await relayProjection(cloudDb, ctx.orgId)).toEqual(
    await relayProjection(box.db, ctx.orgId),
  );
});

test("a relay org's fulfilment is written only by its box", async () => {
  await expect(
    saveFulfilment(
      cloudDb,
      { orgId: ctx.orgId, appVersion: ctx.appVersion },
      { branchId: branches[0]!, values: hours("06:00", "07:00") },
    ),
  ).rejects.toThrow();
  for (const slot of (await slotsAt(branches[0]!)).slots)
    expect(slot.start.slice(11, 16)).toBe("14:00");
});
