import { and, eq, inArray, sql } from "drizzle-orm";
import * as v from "valibot";
import { canonicalJson } from "@shopper/audit";
import {
  org,
  refund,
  refundLine,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { add, money } from "@shopper/money";
import { refundShare } from "@shopper/tax";
import { saleSnapshot } from "../schemas/till/sale";
import type { RefundSnapshot } from "../schemas/till/refund";
import { SaleError } from "../sales/error";
import { refundPayout } from "./payout";

const keys = ["base", "vat", "nhil", "getfund", "covid", "gross", "roundingAdjustment"] as const;

/** Refunded quantity per sold line, across every refund accepted so far. */
export async function refundedQuantities(
  tx: Pick<ShopperDatabase, "select">,
  orgId: string,
  lineIds: string[],
) {
  if (!lineIds.length) return new Map<string, number>();
  const rows = await tx
    .select({
      id: refundLine.originalLineId,
      total: sql<string>`COALESCE(SUM(${refundLine.quantityThousandths}), 0)`,
    })
    .from(refundLine)
    .where(and(eq(refundLine.orgId, orgId), inArray(refundLine.originalLineId, lineIds)))
    .groupBy(refundLine.originalLineId);
  return new Map(rows.map((row) => [row.id, Number(row.total)]));
}

/**
 * Every refunded line is a sold line of the locked sale, within the quantity left, and its tax is exactly
 * the pro-rata share of the sold snapshot; totals and the cash payout are then recomputed.
 */
export async function validateRefund(
  tx: ShopperTransaction,
  orgId: string,
  sold: unknown,
  snapshot: RefundSnapshot,
) {
  const lines = new Map(v.parse(saleSnapshot, sold).lines.map((line) => [line.id, line]));
  const seen = new Set<string>();
  const refunded = await refundedQuantities(
    tx,
    orgId,
    snapshot.lines.map((l) => l.originalLineId),
  );
  for (const line of snapshot.lines) {
    const original = lines.get(line.originalLineId);
    if (
      !original ||
      seen.has(line.originalLineId) ||
      original.productId !== line.productId ||
      original.name !== line.name ||
      original.baseUnit !== line.baseUnit
    )
      throw new SaleError("INVALID_REFERENCE", "Refund line does not match a sold line");
    seen.add(line.originalLineId);
    const before = refunded.get(line.originalLineId) ?? 0;
    const after = before + line.tax.quantityThousandths;
    if (after > original.tax.quantityThousandths)
      throw new SaleError("REFUND_EXCEEDS_SALE", "Refund exceeds the quantity sold");
    if (canonicalJson(refundShare(original.tax, before, after)) !== canonicalJson(line.tax))
      throw new SaleError(
        before > 0 &&
          canonicalJson(refundShare(original.tax, 0, line.tax.quantityThousandths)) ===
            canonicalJson(line.tax)
          ? "REFUND_CONFLICT"
          : "INVALID_REFERENCE",
        "Refund tax is not the sold line's share",
      );
  }
  const totals = Object.fromEntries(
    keys.map((key) => [key, snapshot.lines.reduce((sum, l) => add(sum, l.tax[key]), money(0))]),
  );
  if (canonicalJson(totals) !== canonicalJson(snapshot.totals))
    throw new SaleError("INVALID_TOTALS", "Refund totals do not match its lines");
  await validatePayout(tx, orgId, snapshot);
}

/** Gross already paid back in cash for a sale; the next cash payout is rounded on top of it. */
export async function cashRefunded(
  tx: Pick<ShopperDatabase, "select">,
  orgId: string,
  saleId: string,
) {
  const [prior] = await tx
    .select({ gross: sql<string>`COALESCE(SUM(${refund.gross}), 0)` })
    .from(refund)
    .where(
      and(
        eq(refund.orgId, orgId),
        eq(refund.originalSaleId, saleId),
        eq(refund.tenderKind, "cash"),
      ),
    );
  return money(Number(prior?.gross ?? 0));
}

async function validatePayout(tx: ShopperTransaction, orgId: string, snapshot: RefundSnapshot) {
  const [organisation] = await tx.select().from(org).where(eq(org.id, orgId));
  const payout = refundPayout({
    kind: snapshot.tender.kind,
    priorCash: await cashRefunded(tx, orgId, snapshot.originalSaleId),
    gross: snapshot.totals.gross,
    rounding: organisation?.cashRounding ?? "10p",
  });
  if (payout.total !== snapshot.total || payout.cashRounding !== snapshot.cashRounding)
    throw new SaleError("INVALID_TOTALS", "Refund payout does not match its rounding");
}
