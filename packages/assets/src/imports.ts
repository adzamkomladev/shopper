import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit";
import { asset, type ShopperDatabase } from "@shopper/db-pg";
import { BlobUploadUnavailable, uuidV7Schema, type Blobs } from "@shopper/ports";
import { sha256 } from "@shopper/utils";
import { AssetError } from "./errors";
import { assetPolicy, importUploadInput, MAX_IMPORT_BYTES, UPLOAD_SECONDS } from "./schemas/policy";

export const issueImportUpload = defineCommand({
  name: "asset.upload.issue",
  async run(tx, context, input: { blobs: Blobs; data: unknown }) {
    if (
      input.data &&
      typeof input.data === "object" &&
      "sizeBytes" in input.data &&
      typeof input.data.sizeBytes === "number" &&
      input.data.sizeBytes > MAX_IMPORT_BYTES
    )
      throw new AssetError("File is larger than 10 MB", 413);
    const data = v.parse(importUploadInput, input.data);
    const id = v7();
    const key = `imports/${id}`;
    const grant = await input.blobs
      .createUpload(context.orgId, key, {
        contentType: data.contentType,
        expiresInSeconds: UPLOAD_SECONDS,
      })
      .catch((error: unknown) => {
        if (error instanceof BlobUploadUnavailable)
          throw new AssetError("Direct uploads are unavailable", 503);
        throw error;
      });
    const [saved] = await tx
      .insert(asset)
      .values({
        id,
        orgId: context.orgId,
        purpose: "catalogue_import",
        bucket: assetPolicy.catalogue_import.bucket,
        visibility: assetPolicy.catalogue_import.visibility,
        key,
        ...data,
        actorId: context.actorId,
        expiresAt: new Date(grant.expiresAt),
      })
      .returning();
    return { assetId: id, ...grant, record: saved! };
  },
  audit: (_input, output) => ({ assetId: output.assetId }),
  details: (_input, output) => ({
    entity: "asset",
    entityId: output.assetId,
    after: JSON.parse(JSON.stringify(output.record)),
  }),
});

export async function readImportAsset(
  database: ShopperDatabase,
  blobs: Blobs,
  orgId: string,
  id: string,
  now = Date.now,
) {
  const [found] = await database
    .select()
    .from(asset)
    .where(
      and(
        eq(asset.orgId, orgId),
        eq(asset.id, v.parse(uuidV7Schema, id)),
        eq(asset.purpose, "catalogue_import"),
      ),
    );
  if (!found) throw new AssetError("Import file not found", 404);
  if (!found.expiresAt || found.expiresAt.getTime() <= now())
    throw new AssetError("Import file expired. Choose the file again.", 409);
  let bytes;
  try {
    bytes = await blobs.get(orgId, found.key, MAX_IMPORT_BYTES);
  } catch (error) {
    if (error instanceof RangeError) throw new AssetError("File is larger than 10 MB", 413);
    throw error;
  }
  if (!bytes) throw new AssetError("Import file has not been uploaded", 409);
  if (bytes.byteLength !== found.sizeBytes || (await sha256(bytes)) !== found.sha256)
    throw new AssetError("Import file changed. Choose the file again.", 409);
  return { asset: found, bytes };
}
