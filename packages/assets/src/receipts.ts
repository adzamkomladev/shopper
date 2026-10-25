import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit";
import { asset, sale, type ShopperTransaction } from "@shopper/db-pg";
import { BlobUploadUnavailable, uuidV7Schema, type BlobUpload, type Blobs } from "@shopper/ports";
import { sha256 } from "@shopper/utils";
import { AssetError } from "./errors";
import {
  assetPolicy,
  MAX_RECEIPT_BYTES,
  receiptUploadInput,
  UPLOAD_SECONDS,
} from "./schemas/policy";

const receiptKey = (saleId: string) => `receipts/${saleId}.pdf`;

/** The sale of this device, or 404: other registers never learn that a sale exists. */
async function ownSale(
  tx: ShopperTransaction,
  orgId: string,
  deviceId: string | undefined,
  id: string,
) {
  const [found] = deviceId
    ? await tx
        .select({ id: sale.id, receiptAssetId: sale.receiptAssetId })
        .from(sale)
        .where(and(eq(sale.orgId, orgId), eq(sale.id, id), eq(sale.deviceId, deviceId)))
    : [];
  if (!found) throw new AssetError("Sale not found", 404);
  return found;
}

type Issued = { assetId: string; saleId: string; linked?: true } & Partial<BlobUpload>;

export const issueReceiptUpload = defineCommand({
  name: "asset.receipt.issue",
  /**
   * A linked receipt is final for the same bytes: no grant is minted, and nothing is audited again. Other bytes (the
   * definitive copy once the SDC signed the sale) supersede it.
   */
  async replay(tx, context, input: { blobs: Blobs; data: unknown }) {
    const data = v.safeParse(receiptUploadInput, input.data);
    if (!data.success) return undefined;
    const found = await ownSale(tx, context.orgId, context.deviceId, data.output.saleId);
    if (!found.receiptAssetId) return undefined;
    const [linked] = await tx
      .select({ verified: asset.verifiedSha256 })
      .from(asset)
      .where(and(eq(asset.orgId, context.orgId), eq(asset.id, found.receiptAssetId)));
    return linked?.verified === data.output.sha256
      ? { output: { assetId: found.receiptAssetId, saleId: found.id, linked: true as const } }
      : undefined;
  },
  async run(tx, context, input): Promise<Issued> {
    const size = (input.data as { size?: unknown } | null)?.size;
    if (typeof size === "number" && size > MAX_RECEIPT_BYTES)
      throw new AssetError("Receipt is larger than 1 MiB", 413);
    const data = v.parse(receiptUploadInput, input.data);
    await ownSale(tx, context.orgId, context.deviceId, data.saleId);
    const key = receiptKey(data.saleId);
    const grant = await input.blobs
      .createUpload(context.orgId, key, {
        contentType: "application/pdf",
        expiresInSeconds: UPLOAD_SECONDS,
      })
      .catch((error: unknown) => {
        if (error instanceof BlobUploadUnavailable)
          throw new AssetError("Direct uploads are unavailable", 503);
        throw error;
      });
    const [existing] = await tx
      .select({ id: asset.id })
      .from(asset)
      .where(and(eq(asset.orgId, context.orgId), eq(asset.key, key)));
    const id = existing?.id ?? v7();
    if (!existing)
      await tx.insert(asset).values({
        id,
        orgId: context.orgId,
        purpose: "sale_receipt",
        bucket: assetPolicy.sale_receipt.bucket,
        visibility: assetPolicy.sale_receipt.visibility,
        key,
        fileName: `${data.saleId}.pdf`,
        contentType: "application/pdf",
        sizeBytes: data.size,
        sha256: data.sha256,
      });
    else
      await tx
        .update(asset)
        .set({ sizeBytes: data.size, sha256: data.sha256, updatedAt: new Date() })
        .where(and(eq(asset.orgId, context.orgId), eq(asset.id, id)));
    return { assetId: id, saleId: data.saleId, ...grant };
  },
  audit: (_input, output) => ({ assetId: output.assetId, saleId: output.saleId }),
  details: (_input, output) => ({ entity: "asset", entityId: output.assetId }),
});

async function loadReceipt(
  tx: ShopperTransaction,
  orgId: string,
  deviceId: string | undefined,
  id: string,
) {
  const [found] = await tx
    .select()
    .from(asset)
    .where(
      and(
        eq(asset.orgId, orgId),
        eq(asset.id, v.parse(uuidV7Schema, id)),
        eq(asset.purpose, "sale_receipt"),
      ),
    );
  if (!found) throw new AssetError("Receipt not found", 404);
  const saleId = found.key.slice("receipts/".length, -".pdf".length);
  return { found, saleId, owned: await ownSale(tx, orgId, deviceId, saleId) };
}

export const confirmReceiptUpload = defineCommand({
  name: "asset.receipt.confirm",
  /** Bytes already verified and linked: a retry after a lost response changes nothing. */
  async replay(tx, context, input: { blobs: Blobs; assetId: string }) {
    const { found, owned } = await loadReceipt(tx, context.orgId, context.deviceId, input.assetId);
    return owned.receiptAssetId === found.id && found.verifiedSha256 === found.sha256
      ? { output: { assetId: found.id, saleId: owned.id } }
      : undefined;
  },
  async run(tx, context, input) {
    const { found, owned } = await loadReceipt(tx, context.orgId, context.deviceId, input.assetId);
    // Bounded by the registered size, so a larger object is rejected before it is buffered.
    const bytes = await input.blobs
      .get(context.orgId, found.key, found.sizeBytes)
      .catch((error: unknown) => {
        if (error instanceof RangeError) return null;
        throw error;
      });
    if (!bytes || bytes.byteLength !== found.sizeBytes || (await sha256(bytes)) !== found.sha256) {
      // Do not leave a rejected object behind; the till reissues and uploads again.
      await input.blobs.delete(context.orgId, found.key);
      throw new AssetError("Receipt upload is missing or differs from what was registered", 409);
    }
    await tx
      .update(asset)
      .set({ verifiedSha256: found.sha256, updatedAt: new Date() })
      .where(and(eq(asset.orgId, context.orgId), eq(asset.id, found.id)));
    // A sale links its receipt once; a superseding copy (the signed receipt) replaces the bytes under the same asset.
    if (owned.receiptAssetId !== found.id)
      await tx
        .update(sale)
        .set({ receiptAssetId: found.id })
        .where(and(eq(sale.orgId, context.orgId), eq(sale.id, owned.id)));
    return { assetId: found.id, saleId: owned.id };
  },
  audit: (_input, output) => ({ assetId: output.assetId, saleId: output.saleId }),
  details: (_input, output) => ({ entity: "asset", entityId: output.assetId }),
});
