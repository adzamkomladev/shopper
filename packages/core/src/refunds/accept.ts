import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import { canonicalJson, defineCommand } from "@shopper/audit";
import { refund, refundLine, sale, stockMovement, type ShopperDatabase } from "@shopper/db-pg";
import { sub } from "@shopper/money";
import { sha256 } from "@shopper/utils";
import { saleCustomer } from "../schemas/till/sale";
import { decodeRefundEvent, type RefundEvent } from "../schemas/till/refund";
import { SaleError } from "../sales/error";
import { validateReceipt } from "../sales/receipts";
import type { UploadPrincipal } from "../sales/types";
import { validateRefundAuthority } from "./authority";
import { refundDocument } from "./document";
import { validateRefund } from "./validate";
import { checkReorder } from "../stock/reorder";
import { creditRefund, saleAccount } from "../customers/credit/refunds";
import { salePoints, settleRefundPoints } from "../customers/loyalty/ledger";
import type { Queue } from "@shopper/ports";
import { fiscalDocOf, recordFiscalDoc } from "../fiscal/documents";
import { touchStoreDay } from "../reports/rollup";

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
  queue?: Queue,
) {
  const event = decodeRefundEvent(raw);
  const { refund: snapshot } = event;
  const occurredAt = new Date(
    Math.min(now(), new Date(snapshot.deviceTime).valueOf() - snapshot.clockOffsetMs),
  );
  // The excess is review data kept in the audit row; a replay cannot rebuild it, so the
  // response carries only what both can.
  const saved = await accept(
    db,
    {
      orgId: principal.orgId,
      deviceId: principal.deviceId,
      branchId: principal.branchId,
      actorId: snapshot.cashierId,
      appVersion: snapshot.appVersion,
      deviceTime: new Date(snapshot.deviceTime),
      queue,
    },
    {
      principal,
      event,
      occurredAt,
      proofHash: await sha256(proof),
      contentHash: await sha256(canonicalJson(snapshot)),
    },
  );
  return {
    id: saved.id,
    occurredAt: saved.occurredAt,
    total: saved.total,
    fiscalDocId: saved.fiscalDocId,
  };
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
    return {
      output: {
        ...output(saved),
        fiscalDocId: await fiscalDocOf(tx, ctx.orgId, { refundId: saved.id }),
      },
    };
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
    const account = await saleAccount(tx, ctx.orgId, original.id);
    const held = await salePoints(tx, ctx.orgId, original.id);
    // A credit note takes its number from the register's blocks, overflow numbers included.
    await validateReceipt(tx, {
      ...snapshot,
      receiptNumber: snapshot.creditNoteNumber,
      receiptOverflow: snapshot.creditNoteNumber?.includes("-X") ?? false,
    });
    const { share, excess } = await validateRefund(tx, ctx.orgId, original.payload, snapshot, {
      account,
      points: held,
    });
    const receipt = await refundDocument(tx, snapshot, {
      receiptNumber: original.receiptNumber,
      customer: v.parse(saleCustomer, original.payload).customer,
    });
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
        creditNoteNumber: snapshot.creditNoteNumber,
        reason: snapshot.reason,
        tenderKind: snapshot.tender.kind,
        tenderReference: "reference" in snapshot.tender ? snapshot.tender.reference : null,
        gross: snapshot.totals.gross,
        cashRounding: snapshot.cashRounding,
        total: snapshot.total,
        accountCredit: share.account,
        pointsReturned: share.points,
        pointsValue: share.pointsValue,
        appVersion: snapshot.appVersion,
        eventVersion: input.event.v,
        deviceTime: new Date(snapshot.deviceTime),
        occurredAt: input.occurredAt,
        receipt,
        payload: snapshot,
        contentHash: input.contentHash,
      })
      .returning();
    const fiscalDocId = await recordFiscalDoc(tx, ctx.orgId, receipt, {
      storeId: snapshot.storeId,
      branchId: snapshot.branchId,
      refundId: snapshot.id,
    });
    await creditRefund(tx, ctx, {
      customerId: account.customerId,
      share: share.account,
      refundId: snapshot.id,
      reason: snapshot.reason,
      actorId: snapshot.cashierId,
      occurredAt: input.occurredAt,
    });
    await settleRefundPoints(tx, ctx, {
      held,
      paid: sub(snapshot.totals.gross, share.pointsValue),
      returned: share.points,
      refundId: snapshot.id,
      saleId: original.id,
      actorId: snapshot.cashierId,
      occurredAt: input.occurredAt,
    });
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
    await checkReorder(
      tx,
      ctx,
      snapshot.branchId,
      snapshot.lines.map((line) => line.productId),
    );
    await touchStoreDay(tx, ctx.orgId, snapshot.storeId, input.occurredAt);
    return { ...output(saved!), fiscalDocId, excess };
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
