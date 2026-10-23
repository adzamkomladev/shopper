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
import { add, money, mulRatio, sub, type Money } from "@shopper/money";
import { refundShare } from "@shopper/tax";
import { allocateRefund } from "../customers/credit/refunds";
import { saleSnapshot } from "../schemas/till/sale";
import type { RefundSnapshot } from "../schemas/till/refund";
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
 * the pro-rata share of the sold snapshot; totals and the cash payout are then recomputed. The stated split may
 * never fall below what the server state owes the account and redeemed points (a till cannot pay an on-account sale
 * out in cash; a v1 refund, upcast to no split, is rejected for such a sale since its till already paid it all out).
 * Answers the split to apply: the till's, clamped to what is left, and the excess cut.
 */
export async function validateRefund(
  tx: ShopperTransaction,
  orgId: string,
  sold: unknown,
  snapshot: RefundSnapshot,
  /** The sale's account charge and what refunds credited; its redeemed points and those already returned. */
  state: {
    account: { charged: Money; credited: Money };
    points: { redeemed: { points: number; value: Money } | null; returned: number };
  },
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
  await validatePayout(tx, orgId, snapshot);
  const { redeemed, returned } = state.points;
  const expected = allocateRefund(snapshot.totals.gross, state.account, state.points);
  const perPoint = redeemed ? mulRatio(redeemed.value, 1, redeemed.points) : money(0);
  if (
    snapshot.accountCredit < expected.account ||
    snapshot.pointsReturned < expected.points ||
    snapshot.pointsValue !== mulRatio(perPoint, snapshot.pointsReturned, 1)
  )
    throw new SaleError(
      "INVALID_TOTALS",
      "Refund split does not match the sale's account and points",
    );
  return split(snapshot, {
    account: sub(state.account.charged, state.account.credited),
    points: redeemed ? redeemed.points - returned : 0,
  });
}

/**
 * Registers refunding one sale offline each see none of the other's credit, so a stated split may exceed what is
 * left. A genuine refund is never rejected for it: the split is clamped and the excess kept for review.
 */
function split(snapshot: RefundSnapshot, left: { account: Money; points: number }) {
  const account = money(Math.min(snapshot.accountCredit, Math.max(0, left.account)));
  const points = Math.min(snapshot.pointsReturned, Math.max(0, left.points));
  const pointsValue = snapshot.pointsReturned
    ? mulRatio(snapshot.pointsValue, points, snapshot.pointsReturned)
    : money(0);
  return {
    share: { account, points, pointsValue },
    excess: {
      account: sub(snapshot.accountCredit, account),
      points: snapshot.pointsReturned - points,
    },
  };
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
 * gross less what the refund states went back to the account and to redeemed points.
 */
async function validatePayout(tx: ShopperTransaction, orgId: string, snapshot: RefundSnapshot) {
  const [organisation] = await tx.select().from(org).where(eq(org.id, orgId));
  const rounds = snapshot.tender.kind === "cash" && (organisation?.cashRounding ?? "10p") === "10p";
  const limit = rounds ? 500 : 0;
  const paidOut = sub(sub(snapshot.totals.gross, snapshot.accountCredit), snapshot.pointsValue);
  if (
    Math.abs(snapshot.cashRounding) > limit ||
    snapshot.total !== add(paidOut, snapshot.cashRounding)
  )
    throw new SaleError("INVALID_TOTALS", "Refund payout does not match its rounding");
}
