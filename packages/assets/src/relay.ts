import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { asset, type ShopperTransaction } from "@shopper/db-pg";
import { BlobUploadUnavailable, type Blobs } from "@shopper/ports";
import { AssetError } from "./errors";
import { storedAsRegistered } from "./products";
import { assetPolicy, relayImageOffer, UPLOAD_SECONDS } from "./schemas/policy";

const policy = assetPolicy.product_image;
// Content-addressed under the receipts prefix: the same bytes are one object however many products show them.
const relayImageKey = (digest: string) => `receipts/products/sha256/${digest}`;
const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

/**
 * A box offers its relay org a product photo by digest (v1.5). When the relay already holds those exact bytes the
 * answer is empty and nothing is uploaded again; otherwise it registers the photo (once) and grants a direct upload,
 * so the bytes go straight to storage, never through the API.
 */
export const offerRelayImage = defineCommand({
  name: "relay.image.offer",
  async run(tx, context, input: { blobs: Blobs; data: unknown }) {
    const data = v.parse(relayImageOffer, input.data);
    const key = relayImageKey(data.sha256);
    const [found] = await tx
      .select()
      .from(asset)
      .where(and(eq(asset.orgId, context.orgId), eq(asset.key, key)))
      .for("update");
    if (found && (await verified(tx, input.blobs, found))) return { assetId: found.id };
    const row = found ?? (await register(tx, context.orgId, key, data));
    const upload = await input.blobs
      .createUpload(context.orgId, key, {
        contentType: row.contentType,
        expiresInSeconds: UPLOAD_SECONDS,
      })
      .catch((error: unknown) => {
        if (error instanceof BlobUploadUnavailable)
          throw new AssetError("Direct uploads are unavailable", 503);
        throw error;
      });
    return { assetId: row.id, upload };
  },
  audit: (input, output) => ({ assetId: output.assetId, uploading: "upload" in output }),
  details: (_input, output) => ({ entity: "asset", entityId: output.assetId }),
});

/**
 * The relay org's photo with this digest, its stored bytes checked against what was registered immediately before
 * first use; a photo the box never uploaded (or uploaded wrong) is refused, so the box offers it again.
 */
export async function relayImageId(
  tx: ShopperTransaction,
  blobs: Blobs | undefined,
  orgId: string,
  digest: string,
) {
  const [found] = await tx
    .select()
    .from(asset)
    .where(and(eq(asset.orgId, orgId), eq(asset.key, relayImageKey(digest))));
  if (!found || !blobs || !(await verified(tx, blobs, found)))
    throw new AssetError("A product photo has not reached storage yet", 409);
  return found.id;
}

/** Checks the bytes once; a verified photo is not read again. */
async function verified(tx: ShopperTransaction, blobs: Blobs, found: typeof asset.$inferSelect) {
  if (found.verifiedSha256 === found.sha256) return true;
  if (!(await storedAsRegistered(blobs, found.orgId, found))) return false;
  await tx
    .update(asset)
    .set({ verifiedSha256: found.sha256, updatedAt: new Date() })
    .where(and(eq(asset.orgId, found.orgId), eq(asset.id, found.id)));
  return true;
}

async function register(
  tx: ShopperTransaction,
  orgId: string,
  key: string,
  data: v.InferOutput<typeof relayImageOffer>,
) {
  const [row] = await tx
    .insert(asset)
    .values({
      orgId,
      purpose: "product_image",
      bucket: policy.bucket,
      visibility: policy.visibility,
      key,
      fileName: `${data.sha256}.${extension[data.contentType]}`,
      ...data,
    })
    .returning();
  return row!;
}
