import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit";
import { asset, type ShopperDatabase } from "@shopper/db-pg";
import { BlobUploadUnavailable, uuidV7Schema, type Blobs } from "@shopper/ports";
import { sha256 } from "@shopper/utils";
import { AssetError } from "./errors";
import { assetPolicy, kybUploadInput, MAX_KYB_BYTES, UPLOAD_SECONDS } from "./schemas/policy";

const policy = assetPolicy.kyb_document;
// Under the receipts prefix, so both stores route it to their durable private bucket.
const kybKey = (id: string) => `receipts/kyb/${id}`;

/** A direct-upload grant for one KYB document or Ghana Card scan; the browser PUTs the bytes to storage. */
export const issueKybUpload = defineCommand({
  name: "asset.kyb.issue",
  async run(tx, context, input: { blobs: Blobs; data: unknown }) {
    const data = v.parse(kybUploadInput, input.data);
    const id = v7();
    const grant = await input.blobs
      .createUpload(context.orgId, kybKey(id), {
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
      purpose: "kyb_document",
      bucket: policy.bucket,
      visibility: policy.visibility,
      key: kybKey(id),
      ...data,
      actorId: context.actorId,
    });
    return { assetId: id, ...grant };
  },
  audit: (_input, output) => ({ assetId: output.assetId }),
  details: (_input, output) => ({ entity: "asset", entityId: output.assetId }),
});

/**
 * Whether a KYB asset resolves in this shop and its stored bytes, read up to the size limit, still match the size
 * and digest registered at upload. Checked immediately before the automated checks rely on it.
 */
export async function verifyKybDocument(
  database: ShopperDatabase,
  blobs: Blobs,
  orgId: string,
  id: string,
) {
  const parsed = v.safeParse(uuidV7Schema, id);
  if (!parsed.success) return false;
  const [found] = await database
    .select()
    .from(asset)
    .where(
      and(eq(asset.orgId, orgId), eq(asset.id, parsed.output), eq(asset.purpose, "kyb_document")),
    );
  if (!found) return false;
  const bytes = await blobs.get(orgId, found.key, MAX_KYB_BYTES).catch((error: unknown) => {
    if (error instanceof RangeError) return null;
    throw error;
  });
  return Boolean(
    bytes && bytes.byteLength === found.sizeBytes && (await sha256(bytes)) === found.sha256,
  );
}

/** A short-lived link a reviewer opens to see the document; only a KYB asset of the shop is signed. */
export async function kybDocumentLink(
  database: ShopperDatabase,
  blobs: Blobs,
  orgId: string,
  id: string,
) {
  const [found] = await database
    .select({ key: asset.key })
    .from(asset)
    .where(and(eq(asset.orgId, orgId), eq(asset.id, id), eq(asset.purpose, "kyb_document")));
  if (!found) throw new AssetError("Document not found", 404);
  return blobs.signedUrl(orgId, found.key, 300);
}
