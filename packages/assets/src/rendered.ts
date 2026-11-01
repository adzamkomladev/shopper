import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit";
import { asset, sale, type ShopperDatabase, type ShopperTransaction } from "@shopper/db-pg";
import type { Blobs, Json, Renderer } from "@shopper/ports";
import { sha256 } from "@shopper/utils";
import { AssetError } from "./errors";
import { assetPolicy } from "./schemas/policy";

type Deps = { db: ShopperDatabase; blobs: Blobs; renderer: Renderer; appVersion: string };

/**
 * The PDF of a paid sale that no till printed (an online order): rendered from the stored receipt document once and
 * linked as a verified asset. A sale that already has a verified PDF, the till's or an earlier render, is returned
 * as it is; nothing renders on view.
 */
export async function renderSaleReceipt(deps: Deps, orgId: string, saleId: string) {
  const found = await readSale(deps.db, orgId, saleId);
  if (found.linked) return { ...found.linked, rendered: false };
  if (!found.receipt) throw new AssetError("This sale has no receipt to render", 409);
  const bytes = await deps.renderer.receipt(
    found.receipt as Json,
    { paperMm: 80, reprint: false },
    "pdf",
  );
  // Each render writes its own object, so a racing render can never overwrite bytes another one recorded.
  const assetId = v7();
  const key = `receipts/${saleId}/${assetId}.pdf`;
  await deps.blobs.put(orgId, key, bytes);
  const recorded = await recordRenderedReceipt(
    deps.db,
    { orgId, appVersion: deps.appVersion },
    { saleId, assetId, key, size: bytes.byteLength, sha256: await sha256(bytes) },
  );
  return { assetId: recorded.assetId, key: recorded.key, rendered: recorded.rendered };
}

const recordRenderedReceipt = defineCommand({
  name: "asset.receipt.render",
  async run(
    tx,
    context,
    input: { saleId: string; assetId: string; key: string; size: number; sha256: string },
  ) {
    await tx
      .select({ id: sale.id })
      .from(sale)
      .where(and(eq(sale.orgId, context.orgId), eq(sale.id, input.saleId)))
      .for("update");
    // Under the sale's lock the first render to commit wins; a later one keeps that PDF and leaves its own unused.
    const { linked } = await readSale(tx, context.orgId, input.saleId);
    if (linked) return { ...linked, saleId: input.saleId, rendered: false };
    await tx.insert(asset).values({
      id: input.assetId,
      orgId: context.orgId,
      purpose: "sale_receipt",
      bucket: assetPolicy.sale_receipt.bucket,
      visibility: assetPolicy.sale_receipt.visibility,
      key: input.key,
      fileName: `${input.saleId}.pdf`,
      contentType: "application/pdf",
      sizeBytes: input.size,
      sha256: input.sha256,
      verifiedSha256: input.sha256,
    });
    await tx
      .update(sale)
      .set({ receiptAssetId: input.assetId })
      .where(and(eq(sale.orgId, context.orgId), eq(sale.id, input.saleId)));
    return { assetId: input.assetId, key: input.key, saleId: input.saleId, rendered: true };
  },
  audit: (_input, output) => output,
  details: (_input, output) => ({ entity: "asset", entityId: output.assetId }),
});

async function readSale(db: ShopperDatabase | ShopperTransaction, orgId: string, id: string) {
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
      ? { assetId: found.assetId, key: found.key }
      : null;
  return { receipt: found.receipt, linked };
}
