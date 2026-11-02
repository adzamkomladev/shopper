import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit";
import { asset, product, type ShopperDatabase, type ShopperTransaction } from "@shopper/db-pg";
import { BlobUploadUnavailable, uuidV7Schema, type Blobs } from "@shopper/ports";
import { sha256 } from "@shopper/utils";
import { AssetError } from "./errors";
import {
  assetPolicy,
  MAX_PRODUCT_IMAGE_BYTES,
  productImageInput,
  productImageUploadInput,
  UPLOAD_SECONDS,
} from "./schemas/policy";

const policy = assetPolicy.product_image;
// Under the receipts prefix, so both stores route it to their durable private bucket.
const imageKey = (id: string) => `receipts/products/${id}`;

/** A direct-upload grant for one product photo; the browser PUTs the bytes to storage. */
export const issueProductImageUpload = defineCommand({
  name: "asset.product_image.issue",
  async run(tx, context, input: { blobs: Blobs; productId: string; data: unknown }) {
    const data = v.parse(productImageUploadInput, input.data);
    await requireProduct(tx, context.orgId, input.productId);
    const id = v7();
    const grant = await input.blobs
      .createUpload(context.orgId, imageKey(id), {
        contentType: data.contentType,
        expiresInSeconds: UPLOAD_SECONDS,
      })
      .catch((error: unknown) => {
        if (error instanceof BlobUploadUnavailable)
          throw new AssetError("Direct uploads are unavailable", 503);
        throw error;
      });
    await tx.insert(asset).values({
      id,
      orgId: context.orgId,
      purpose: "product_image",
      bucket: policy.bucket,
      visibility: policy.visibility,
      key: imageKey(id),
      ...data,
      actorId: context.actorId,
    });
    return { assetId: id, ...grant };
  },
  audit: (input, output) => ({ productId: input.productId, assetId: output.assetId }),
  details: (_input, output) => ({ entity: "asset", entityId: output.assetId }),
});

/**
 * Shows an uploaded photo on the product, or removes it with a null asset. The stored bytes, read up to the size
 * limit, must still match the size and digest registered at upload: checked here, immediately before linking.
 */
export const setProductImage = defineCommand({
  name: "product.image.set",
  async run(tx, context, input: { blobs: Blobs; productId: string; data: unknown }) {
    const data = v.parse(productImageInput, input.data);
    const before = await requireProduct(tx, context.orgId, input.productId);
    if (data.assetId) await requireStoredImage(tx, input.blobs, context.orgId, data.assetId);
    await tx
      .update(product)
      .set({ imageAssetId: data.assetId, updatedAt: new Date() })
      .where(and(eq(product.orgId, context.orgId), eq(product.id, input.productId)));
    return { assetId: data.assetId, previousAssetId: before.imageAssetId };
  },
  audit: (_input, output) => output,
  details: (input, output) => ({
    entity: "product",
    entityId: input.productId,
    before: { imageAssetId: output.previousAssetId },
    after: { imageAssetId: output.assetId },
  }),
});

/** A five-minute link to the product's photo for the back office, or null when it has none. */
export async function productImageLink(
  database: ShopperDatabase,
  blobs: Blobs,
  orgId: string,
  productId: string,
) {
  if (!v.is(uuidV7Schema, productId)) throw new AssetError("Product not found", 404);
  const [found] = await database
    .select({ key: asset.key })
    .from(product)
    .leftJoin(asset, and(eq(asset.orgId, product.orgId), eq(asset.id, product.imageAssetId)))
    .where(and(eq(product.orgId, orgId), eq(product.id, productId)));
  if (!found) throw new AssetError("Product not found", 404);
  return found.key ? blobs.createDownload(orgId, found.key, 300) : null;
}

async function requireProduct(tx: ShopperTransaction, orgId: string, id: string) {
  const [found] = v.is(uuidV7Schema, id)
    ? await tx
        .select({ imageAssetId: product.imageAssetId })
        .from(product)
        .where(and(eq(product.orgId, orgId), eq(product.id, id)))
        .for("update")
    : [];
  if (!found) throw new AssetError("Product not found", 404);
  return found;
}

async function requireStoredImage(tx: ShopperTransaction, blobs: Blobs, orgId: string, id: string) {
  const [found] = await tx
    .select()
    .from(asset)
    .where(and(eq(asset.orgId, orgId), eq(asset.id, id), eq(asset.purpose, "product_image")));
  if (!found) throw new AssetError("Photo not found", 404);
  const bytes = await blobs
    .get(orgId, found.key, MAX_PRODUCT_IMAGE_BYTES)
    .catch((error: unknown) => {
      if (error instanceof RangeError) return null;
      throw error;
    });
  if (!bytes || bytes.byteLength !== found.sizeBytes || (await sha256(bytes)) !== found.sha256)
    throw new AssetError("The uploaded photo does not match what was registered", 409);
}
