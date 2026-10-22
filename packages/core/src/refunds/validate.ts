import { and, eq, inArray, sql } from "drizzle-orm";
import * as v from "valibot";
import { canonicalJson } from "@shopper/audit";
import {
  org,
  product,
  refundLine,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { add, money, sub } from "@shopper/money";
import { refundShare } from "@shopper/tax";
import { saleSnapshot } from "../schemas/till/sale";
import type { RefundSnapshot } from "../schemas/till/refund";
import type { RefundAllocation } from "../customers/types";
import { SaleError } from "../sales/error";

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
  /** The part credited back to the account and to redeemed points; only the rest is paid out. */
  allocation: RefundAllocation,
) {
  const lines = new Map(v.parse(saleSnapshot, sold).lines.map((line) => [line.id, line]));
  const seen = new Set<string>();
  const refunded = await refundedQuantities(
    tx,
    orgId,
    snapshot.lines.map((l) => l.originalLineId),
  );
  const finalSale = await finalSaleProducts(
    tx,
    orgId,
    snapshot.lines.map((l) => l.productId),
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
    if (finalSale.has(line.productId))
      throw new SaleError("FINAL_SALE", "This item is a final sale and cannot be returned");
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
  await validatePayout(tx, orgId, snapshot, allocation);
}

async function finalSaleProducts(tx: ShopperTransaction, orgId: string, productIds: string[]) {
  const rows = await tx
    .select({ id: product.id })
    .from(product)
    .where(
      and(eq(product.orgId, orgId), inArray(product.id, productIds), eq(product.finalSale, true)),
    );
  return new Set(rows.map((row) => row.id));
}

/**
 * Cash on a 10p org may be rounded by up to 5p either way: the till rounds on the cumulative cash paid,
 * which differs between registers, so the server accepts any rounding within bounds. Everything else pays the
 * gross less what went back to the account and to redeemed points, which the refund must state as the server works it out.
 */
async function validatePayout(
  tx: ShopperTransaction,
  orgId: string,
  snapshot: RefundSnapshot,
  allocation: RefundAllocation,
) {
  const [organisation] = await tx.select().from(org).where(eq(org.id, orgId));
  const rounds = snapshot.tender.kind === "cash" && (organisation?.cashRounding ?? "10p") === "10p";
  const limit = rounds ? 500 : 0;
  const paidOut = sub(sub(snapshot.totals.gross, allocation.account), allocation.pointsValue);
  if (
    Math.abs(snapshot.cashRounding) > limit ||
    snapshot.total !== add(paidOut, snapshot.cashRounding) ||
    snapshot.accountCredit !== allocation.account ||
    snapshot.pointsReturned !== allocation.points ||
    snapshot.pointsValue !== allocation.pointsValue
  )
    throw new SaleError("INVALID_TOTALS", "Refund payout does not match its rounding");
}
