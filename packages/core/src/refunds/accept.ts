import { and, eq } from "drizzle-orm";
import { canonicalJson, defineCommand } from "@shopper/audit";
import { refund, refundLine, sale, stockMovement, type ShopperDatabase } from "@shopper/db-pg";
import { sha256 } from "@shopper/utils";
import { decodeRefundEvent, type RefundEvent } from "../schemas/till/refund";
import { SaleError } from "../sales/error";
import type { UploadPrincipal } from "../sales/types";
import { validateRefundAuthority } from "./authority";
import { refundDocument } from "./document";
import { validateRefund } from "./validate";

type Input = {
  principal: UploadPrincipal;
  event: RefundEvent;
  proofHash: string;
  contentHash: string;
  occurredAt: Date;
};

export async function acceptRefund(
  db: ShopperDatabase,
  principal: UploadPrincipal,
  raw: unknown,
  proof: string,
  now = Date.now,
) {
  const event = decodeRefundEvent(raw);
  const { refund: snapshot } = event;
  const occurredAt = new Date(
    Math.min(now(), new Date(snapshot.deviceTime).valueOf() - snapshot.clockOffsetMs),
  );
  return accept(
    db,
    {
      orgId: principal.orgId,
      deviceId: principal.deviceId,
      branchId: principal.branchId,
      actorId: snapshot.cashierId,
      appVersion: snapshot.appVersion,
      deviceTime: new Date(snapshot.deviceTime),
    },
    {
      principal,
      event,
      occurredAt,
      proofHash: await sha256(proof),
      contentHash: await sha256(canonicalJson(snapshot)),
    },
  );
}

const accept = defineCommand({
  name: "refund.accept",
  async replay(tx, ctx, input: Input) {
    const [saved] = await tx
      .select()
      .from(refund)
      .where(and(eq(refund.orgId, ctx.orgId), eq(refund.id, input.event.refund.id)));
    if (!saved) return undefined;
    await validateRefundAuthority(
      tx,
      ctx,
      input.principal,
      input.event.refund,
      input.proofHash,
      saved.occurredAt,
    );
    if (saved.contentHash !== input.contentHash)
      throw new SaleError("CONFLICT", "Refund identity already has different content");
    return { output: output(saved) };
  },
  async run(tx, ctx, input) {
    const snapshot = input.event.refund;
    await validateRefundAuthority(
      tx,
      ctx,
      input.principal,
      snapshot,
      input.proofHash,
      input.occurredAt,
    );
    const [original] = await tx
      .select()
      .from(sale)
      .where(and(eq(sale.orgId, ctx.orgId), eq(sale.id, snapshot.originalSaleId)))
      .for("update");
    if (!original || original.storeId !== input.principal.storeId)
      throw new SaleError("INVALID_REFERENCE", "Original sale not found in this store");
    await validateRefund(tx, ctx.orgId, original.payload, snapshot);
    const receipt = await refundDocument(tx, snapshot, original.receiptNumber);
    const [saved] = await tx
      .insert(refund)
      .values({
        id: snapshot.id,
        orgId: ctx.orgId,
        deviceId: snapshot.deviceId,
        storeId: snapshot.storeId,
        branchId: snapshot.branchId,
        cashierId: snapshot.cashierId,
        sessionId: snapshot.sessionId,
        approverId: snapshot.approverId,
        originalSaleId: original.id,
        reason: snapshot.reason,
        tenderKind: snapshot.tender.kind,
        tenderReference: "reference" in snapshot.tender ? snapshot.tender.reference : null,
        gross: snapshot.totals.gross,
        cashRounding: snapshot.cashRounding,
        total: snapshot.total,
        appVersion: snapshot.appVersion,
        eventVersion: input.event.v,
        deviceTime: new Date(snapshot.deviceTime),
        occurredAt: input.occurredAt,
        receipt,
        payload: snapshot,
        contentHash: input.contentHash,
      })
      .returning();
    await tx.insert(refundLine).values(
      snapshot.lines.map((line) => ({
        id: line.id,
        orgId: ctx.orgId,
        refundId: snapshot.id,
        originalLineId: line.originalLineId,
        productId: line.productId,
        quantityThousandths: line.tax.quantityThousandths,
        payload: line,
      })),
    );
    await tx.insert(stockMovement).values(
      snapshot.lines.map((line) => ({
        orgId: ctx.orgId,
        branchId: snapshot.branchId,
        productId: line.productId,
        refundId: snapshot.id,
        refundLineId: line.id,
        reason: "return" as const,
        quantityThousandths: line.tax.quantityThousandths,
        occurredAt: input.occurredAt,
      })),
    );
    return output(saved!);
  },
  audit: (input, result) => ({
    ...result,
    originalSaleId: input.event.refund.originalSaleId,
    tender: input.event.refund.tender.kind,
    lines: input.event.refund.lines.map((line) => ({
      originalLineId: line.originalLineId,
      quantityThousandths: line.tax.quantityThousandths,
    })),
  }),
  details: (_input, result) => ({ entity: "refund", entityId: result.id }),
});

const output = (saved: typeof refund.$inferSelect) => ({
  id: saved.id,
  occurredAt: saved.occurredAt.toISOString(),
  total: Number(saved.total),
});
