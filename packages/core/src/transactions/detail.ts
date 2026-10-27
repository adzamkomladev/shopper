import { and, eq, inArray, or, sql } from "drizzle-orm";
import {
  auditLog,
  customer,
  fiscalDoc,
  payment,
  paymentRefund,
  refund,
  sale,
  saleLine,
  saleTender,
  user,
  type ShopperDatabase,
} from "@shopper/db-pg";
import { inSnapshot } from "../reports/read";
import type { SaleSnapshot } from "../schemas/till/sale";

type Line = SaleSnapshot["lines"][number];

/**
 * One sale as the explorer's drill-down shows it, or null when it is not the org's or lies outside `scope`: its lines
 * with their tax snapshot, tenders with the MoMo payment behind them, refunds with any provider refund, the fiscal
 * documents and the audit trail of the sale, its refunds and its payments.
 */
export async function readTransaction(
  db: ShopperDatabase,
  orgId: string,
  id: string,
  scope?: string[],
) {
  return inSnapshot(db, async (tx) => {
    const [row] = await tx
      .select({ sale, cashierName: user.name, customerName: customer.name })
      .from(sale)
      .leftJoin(user, and(eq(user.orgId, sale.orgId), eq(user.id, sale.cashierId)))
      .leftJoin(customer, and(eq(customer.orgId, sale.orgId), eq(customer.id, sale.customerId)))
      .where(and(eq(sale.orgId, orgId), eq(sale.id, id)));
    if (!row || (scope && !scope.includes(row.sale.branchId))) return null;
    // One client runs one query at a time, so the reads go in turn.
    const lines = await tx
      .select()
      .from(saleLine)
      .where(and(eq(saleLine.orgId, orgId), eq(saleLine.saleId, id)));
    const tenders = await tx
      .select({ tender: saleTender, payment })
      .from(saleTender)
      .leftJoin(
        payment,
        and(eq(payment.orgId, saleTender.orgId), eq(payment.id, saleTender.paymentId)),
      )
      .where(and(eq(saleTender.orgId, orgId), eq(saleTender.saleId, id)))
      .orderBy(saleTender.position);
    const refunds = await tx
      .select()
      .from(refund)
      .where(and(eq(refund.orgId, orgId), eq(refund.originalSaleId, id)))
      .orderBy(refund.occurredAt);
    const fiscal = await tx
      .select()
      .from(fiscalDoc)
      .where(
        and(
          eq(fiscalDoc.orgId, orgId),
          // Credit notes name their refund, never the sale.
          or(
            eq(fiscalDoc.saleId, id),
            refunds.length
              ? inArray(
                  fiscalDoc.refundId,
                  refunds.map((r) => r.id),
                )
              : undefined,
          ),
        ),
      );
    const refundIds = refunds.map((r) => r.id);
    const references = tenders.flatMap((t) => (t.payment ? [t.payment.reference] : []));
    const providerRefunds = refundIds.length
      ? await tx
          .select()
          .from(paymentRefund)
          .where(and(eq(paymentRefund.orgId, orgId), inArray(paymentRefund.refundId, refundIds)))
      : [];
    const audit = await tx
      .select({
        id: auditLog.id,
        command: auditLog.command,
        actorId: auditLog.actorId,
        actorName: user.name,
        approverId: auditLog.approverId,
        at: auditLog.createdAt,
        payload: auditLog.payload,
      })
      .from(auditLog)
      .leftJoin(user, and(eq(user.orgId, auditLog.orgId), eq(user.id, auditLog.actorId)))
      .where(
        and(
          eq(auditLog.orgId, orgId),
          or(
            and(eq(auditLog.entity, "sale"), eq(auditLog.entityId, row.sale.localId)),
            refundIds.length
              ? and(eq(auditLog.entity, "refund"), inArray(auditLog.entityId, refundIds))
              : undefined,
            references.length
              ? inArray(sql<string>`${auditLog.payload}->>'reference'`, references)
              : undefined,
          ),
        ),
      )
      .orderBy(auditLog.createdAt);
    return {
      id: row.sale.id,
      receiptNumber: row.sale.receiptNumber,
      occurredAt: row.sale.occurredAt.toISOString(),
      branchId: row.sale.branchId,
      deviceId: row.sale.deviceId,
      cashier: { id: row.sale.cashierId, name: row.cashierName },
      customer: row.sale.customerId ? { id: row.sale.customerId, name: row.customerName } : null,
      status: refunds.length ? ("refunded" as const) : ("completed" as const),
      total: row.sale.total,
      cashRounding: row.sale.cashRounding,
      change: row.sale.change,
      lines: lines.map((l) => {
        const line = l.payload as Line;
        return {
          id: line.id,
          name: line.name,
          sku: line.sku,
          quantity: line.tax.quantityThousandths,
          unitPrice: line.tax.unitPrice,
          discount: line.discount,
          tax: {
            vat: line.tax.vat,
            nhil: line.tax.nhil,
            getfund: line.tax.getfund,
            covid: line.tax.covid,
          },
          total: line.tax.gross,
        };
      }),
      tenders: tenders.map((t) => ({
        kind: t.tender.kind,
        amount: t.tender.amount,
        reference: t.tender.reference,
        last4: t.tender.last4,
        payment: t.payment && {
          reference: t.payment.reference,
          provider: t.payment.provider,
          status: t.payment.status,
          network: t.payment.network,
          providerReference: t.payment.providerReference,
        },
      })),
      refunds: refunds.map((r) => ({
        id: r.id,
        creditNoteNumber: r.creditNoteNumber,
        occurredAt: r.occurredAt.toISOString(),
        reason: r.reason,
        tenderKind: r.tenderKind,
        total: r.total,
        providerRefunds: providerRefunds
          .filter((p) => p.refundId === r.id)
          .map((p) => ({ status: p.status, amount: p.amount, reason: p.failureReason })),
      })),
      fiscal: fiscal.map((doc) => ({
        kind: doc.kind,
        invoiceNumber: doc.invoiceNumber,
        status: doc.status,
        sdcId: doc.sdcId,
        refundId: doc.refundId,
        signedAt: doc.signedAt?.toISOString() ?? null,
      })),
      audit: audit.map((a) => ({ ...a, at: a.at.toISOString() })),
    };
  });
}
