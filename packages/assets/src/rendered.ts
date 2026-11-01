import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit";
import { asset, sale, type ShopperDatabase } from "@shopper/db-pg";
import type { Blobs, Json, Renderer } from "@shopper/ports";
import { sha256 } from "@shopper/utils";
import { AssetError } from "./errors";
import { receiptKey } from "./receipts";
import { assetPolicy } from "./schemas/policy";

type Deps = { db: ShopperDatabase; blobs: Blobs; renderer: Renderer; appVersion: string };

/**
 * The PDF of a paid sale that no till printed (an online order): rendered from the stored receipt document once,
 * kept under the same key a till's upload would use, and linked as a verified asset. A sale that already has a
 * verified PDF, the till's or an earlier render, is returned as it is; nothing renders on view.
 */
export async function renderSaleReceipt(deps: Deps, orgId: string, saleId: string) {
  const found = await readSale(deps.db, orgId, saleId);
  if (found.linked) return { assetId: found.linked.id, key: found.linked.key, rendered: false };
  if (!found.receipt) throw new AssetError("This sale has no receipt to render", 409);
  const bytes = await deps.renderer.receipt(
    found.receipt as Json,
    { paperMm: 80, reprint: false },
    "pdf",
  );
  const key = receiptKey(saleId);
  // Server-written bytes: their digest is known here, so the asset is verified as it is recorded.
  await deps.blobs.put(orgId, key, bytes);
  const recorded = await recordRenderedReceipt(
    deps.db,
    { orgId, appVersion: deps.appVersion },
    { saleId, key, size: bytes.byteLength, sha256: await sha256(bytes) },
  );
  return { assetId: recorded.assetId, key, rendered: true };
}

const recordRenderedReceipt = defineCommand({
  name: "asset.receipt.render",
  async run(tx, context, input: { saleId: string; key: string; size: number; sha256: string }) {
    await tx
      .select({ id: sale.id })
      .from(sale)
      .where(and(eq(sale.orgId, context.orgId), eq(sale.id, input.saleId)))
      .for("update");
    const [existing] = await tx
      .select({ id: asset.id })
      .from(asset)
      .where(and(eq(asset.orgId, context.orgId), eq(asset.key, input.key)));
    const id = existing?.id ?? v7();
    const values = {
      sizeBytes: input.size,
      sha256: input.sha256,
      verifiedSha256: input.sha256,
      updatedAt: new Date(),
    };
    if (existing)
      await tx
        .update(asset)
        .set(values)
        .where(and(eq(asset.orgId, context.orgId), eq(asset.id, id)));
    else
      await tx.insert(asset).values({
        ...values,
        id,
        orgId: context.orgId,
        purpose: "sale_receipt",
        bucket: assetPolicy.sale_receipt.bucket,
        visibility: assetPolicy.sale_receipt.visibility,
        key: input.key,
        fileName: `${input.saleId}.pdf`,
        contentType: "application/pdf",
      });
    await tx
      .update(sale)
      .set({ receiptAssetId: id })
      .where(and(eq(sale.orgId, context.orgId), eq(sale.id, input.saleId)));
    return { assetId: id, saleId: input.saleId, sha256: input.sha256 };
  },
  audit: (_input, output) => output,
  details: (_input, output) => ({ entity: "asset", entityId: output.assetId }),
});

async function readSale(db: ShopperDatabase, orgId: string, id: string) {
  const [found] = await db
    .select({
      receipt: sale.receipt,
      assetId: asset.id,
      key: asset.key,
      sha: asset.sha256,
      verified: asset.verifiedSha256,
    })
    .from(sale)
    .leftJoin(asset, and(eq(asset.orgId, sale.orgId), eq(asset.id, sale.receiptAssetId)))
    .where(and(eq(sale.orgId, orgId), eq(sale.id, id)));
  if (!found) throw new AssetError("Sale not found", 404);
  const linked =
    found.assetId && found.key && found.verified && found.verified === found.sha
      ? { id: found.assetId, key: found.key }
      : null;
  return { receipt: found.receipt, linked };
}
