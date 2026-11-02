// Product photos go from the back office straight to object storage and reach the store through a short redirect:
//   - issueProductImageUpload grants one direct PUT for a jpeg, png or webp of at most 2 MB;
//   - setProductImage links it only once the stored bytes match the registered size and SHA-256, and audits it;
//   - GET /shop/:code/images/:assetId redirects to a 300 s download only for an image linked to a product the store
//     shows; a hidden product's photo, an unlinked or non-image asset and another shop's code are all 404.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { boxBlobs } from "@shopper/adapters-box";
import { issueKybUpload, issueProductImageUpload, setProductImage } from "@shopper/assets";
import type { Blobs } from "@shopper/ports";
import { sha256 } from "@shopper/utils";
import { rustfs } from "../../../tooling/storage/buckets";
import { fileBucket } from "../../support/assets/buckets";
import { shopHttp } from "../../support/shop/http";
import { stockShop } from "../../support/shop/store";
import { shopWorld } from "../../support/shop/world";

let world: Awaited<ReturnType<typeof shopWorld>>;
let http: ReturnType<typeof shopHttp>;
let shop: Awaited<ReturnType<typeof stockShop>>;
let blobs: Blobs;
let directory: string;

beforeAll(async () => {
  world = await shopWorld();
  directory = await mkdtemp(join(tmpdir(), "shopper-images-"));
  ({ blobs } = await boxBlobs(directory, {
    baseUrl: "http://127.0.0.1",
    secret: new Uint8Array(32).fill(9),
    receiptsObjectStorage: { ...rustfs, bucket: await fileBucket() },
  }));
  http = shopHttp(world, { blobs });
  shop = await stockShop(world.db, world.a);
}, 120_000);
afterAll(async () => {
  http?.close();
  await world?.close();
  await rm(directory, { recursive: true, force: true });
});

const png = (text: string) =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, ...new TextEncoder().encode(text)]);

/** A grant for `registered` and a PUT of `sent` (the same bytes unless a test tampers). */
async function upload(productId: string, registered: Uint8Array<ArrayBuffer>, sent = registered) {
  const grant = await issueProductImageUpload(world.db, world.a.context, {
    blobs,
    productId,
    data: {
      fileName: "photo.png",
      contentType: "image/png",
      sizeBytes: registered.byteLength,
      sha256: await sha256(registered),
    },
  });
  const put = await fetch(grant.url, { method: "PUT", headers: grant.headers, body: sent });
  expect(put.ok).toBe(true);
  return grant.assetId;
}
const link = (productId: string, assetId: string | null) =>
  setProductImage(world.db, world.a.context, { blobs, productId, data: { assetId } });
const image = (assetId: string, code = world.a.slug) =>
  http.request(`/shop/${code}/images/${assetId}`);
const linked = async (productId: string) =>
  (
    await world.db
      .select({ imageAssetId: schema.product.imageAssetId })
      .from(schema.product)
      .where(eq(schema.product.id, productId))
  )[0]!.imageAssetId;

test("a verified photo links to the product, is audited and redirects to a short download", async () => {
  const productId = await shop.product("Gari 1kg");
  const bytes = png(`gari ${crypto.randomUUID()}`);
  const assetId = await upload(productId, bytes);
  await link(productId, assetId);
  expect(await linked(productId)).toBe(assetId);
  const [audit] = await world.db
    .select({ payload: schema.auditLog.payload })
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.orgId, world.a.orgId),
        eq(schema.auditLog.command, "product.image.set"),
        eq(schema.auditLog.entityId, productId),
      ),
    );
  expect(audit?.payload).toMatchObject({ assetId });

  const response = await image(assetId);
  expect(response.status).toBe(302);
  expect(response.headers.get("cache-control")).toBe("public, max-age=240");
  const download = await fetch(response.headers.get("location")!);
  expect(new Uint8Array(await download.arrayBuffer())).toEqual(bytes);

  // Removing it unlinks the photo and the store stops serving it.
  await link(productId, null);
  expect(await linked(productId)).toBeNull();
  expect((await image(assetId)).status).toBe(404);
});

test("bytes that differ from what was registered are refused and never linked", async () => {
  const productId = await shop.product("Shea butter");
  const assetId = await upload(productId, png("the real photo"), png("a fake photo!!"));
  await expect(link(productId, assetId)).rejects.toMatchObject({ status: 409 });
  expect(await linked(productId)).toBeNull();
});

test("only images, at most 2 MB, get an upload grant", async () => {
  const productId = await shop.product("Palm oil");
  const grant = (data: Record<string, unknown>) =>
    issueProductImageUpload(world.db, world.a.context, {
      blobs,
      productId,
      data: {
        fileName: "photo.png",
        contentType: "image/png",
        sizeBytes: 10,
        ...data,
        sha256: "a".repeat(64),
      },
    });
  await expect(grant({ fileName: "page.html", contentType: "text/html" })).rejects.toThrow();
  await expect(grant({ sizeBytes: 2 * 1024 * 1024 + 1 })).rejects.toThrow();
  await expect(grant({ fileName: "photo.webp", contentType: "image/webp" })).resolves.toMatchObject(
    {
      method: "PUT",
    },
  );
  // Another shop's product is not this shop's to photograph.
  const foreign = await (await stockShop(world.db, world.b)).product("Kumasi shito");
  await expect(
    issueProductImageUpload(world.db, world.a.context, {
      blobs,
      productId: foreign,
      data: {
        fileName: "photo.png",
        contentType: "image/png",
        sizeBytes: 10,
        sha256: "a".repeat(64),
      },
    }),
  ).rejects.toMatchObject({ status: 404 });
});

test("the store serves only photos of products it shows, and only under their own shop", async () => {
  const hidden = await shop.product("Staff tea", { visible: false });
  const hiddenPhoto = await upload(hidden, png(`tea ${crypto.randomUUID()}`));
  await link(hidden, hiddenPhoto);
  expect((await image(hiddenPhoto)).status).toBe(404);

  const shown = await shop.product("Plantain chips");
  const unlinked = await upload(shown, png(`chips ${crypto.randomUUID()}`));
  expect((await image(unlinked)).status).toBe(404);
  await link(shown, unlinked);
  expect((await image(unlinked)).status).toBe(302);
  expect((await image(unlinked, world.b.slug)).status).toBe(404);

  const document = await issueKybUpload(world.db, world.a.context, {
    blobs,
    data: {
      fileName: "scan.pdf",
      contentType: "application/pdf",
      sizeBytes: 1,
      sha256: "b".repeat(64),
    },
  });
  expect((await image(document.assetId)).status).toBe(404);
  expect((await image("not-a-uuid")).status).toBe(404);
});
