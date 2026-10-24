import { v7 } from "uuid";
import { add, money, sub } from "@shopper/money";
import { allocateRefund } from "../../customers/credit/refunds";
import { refundShare } from "@shopper/tax";
import type { RefundSnapshot } from "../../schemas/till/refund";
import { refundPayout } from "../../refunds/payout";
import { TillError } from "../error";
import type { Original, Policy } from "./types";

const DAY = 86_400_000;
const keys = ["base", "vat", "nhil", "getfund", "covid", "gross", "roundingAdjustment"] as const;

/** The window is occurredAt + returnWindowDays days (Accra is UTC all year). */
export function eligibility(original: Original, policy: Policy, at: Date) {
  const windowEndsAt = new Date(
    Date.parse(original.occurredAt) + policy.returnWindowDays * DAY,
  ).toISOString();
  const withinWindow = at.toISOString() <= windowEndsAt;
  const lines = original.sale.lines.map((line) => {
    const sold = line.tax.quantityThousandths;
    const refunded = original.refunded[line.id] ?? 0;
    const remaining = sold - refunded;
    return {
      lineId: line.id,
      productId: line.productId,
      name: line.name,
      soldThousandths: sold,
      refundedThousandths: refunded,
      remainingThousandths: remaining,
      status:
        remaining === 0
          ? ("returned" as const)
          : original.finalSale[line.productId]
            ? ("final" as const)
            : ("eligible" as const),
    };
  });
  return {
    origin: original.origin,
    windowEndsAt,
    withinWindow,
    /** A manager must approve: the register asks for one on every return, or the sale is out of the window. */
    approvalRequired: policy.requirePinForReturns || !withinWindow,
    refundable: lines.some((line) => line.status === "eligible"),
    lines,
  };
}

type Request = {
  lines: { lineId: string; quantityThousandths: number }[];
  tender: RefundSnapshot["tender"];
  reason: string;
  approverId: string | null;
};
type Stamp = Pick<
  RefundSnapshot,
  | "orgId"
  | "deviceId"
  | "storeId"
  | "branchId"
  | "cashierId"
  | "sessionId"
  | "appVersion"
  | "deviceTime"
  | "clockOffsetMs"
>;

/** The refund event lines priced from the SOLD tax snapshot, with totals and the cash payout recomputed from them. */
export function buildRefund(
  original: Original,
  request: Request,
  stamp: Stamp,
  rounding: "none" | "10p",
  /** Fixed ids and credit-note number, when the event was already sent to the server under them. */
  ids: { id?: string; lineIds?: string[]; creditNoteNumber?: string } = {},
): RefundSnapshot {
  const seen = new Set<string>();
  const lines = request.lines.map(({ lineId, quantityThousandths }, index) => {
    const sold = original.sale.lines.find((line) => line.id === lineId);
    if (!sold) throw new TillError("LINE_UNKNOWN", "That line is not on the sale");
    if (seen.has(lineId))
      throw new TillError("QUANTITY_INVALID", "Each line can be refunded once per refund");
    seen.add(lineId);
    if (!Number.isSafeInteger(quantityThousandths) || quantityThousandths <= 0)
      throw new TillError(
        "QUANTITY_INVALID",
        "Quantity must be a positive whole number of thousandths",
      );
    const before = original.refunded[lineId] ?? 0;
    if (before + quantityThousandths > sold.tax.quantityThousandths)
      throw new TillError("REFUND_EXCEEDS_SALE", "That is more than is left to refund");
    if (original.finalSale[sold.productId])
      throw new TillError("FINAL_SALE", `${sold.name} is final sale and cannot be returned`);
    return {
      id: ids.lineIds?.[index] ?? v7(),
      originalLineId: sold.id,
      productId: sold.productId,
      name: sold.name,
      baseUnit: sold.baseUnit,
      tax: refundShare(sold.tax, before, before + quantityThousandths),
    };
  });
  const totals = Object.fromEntries(
    keys.map((key) => [key, lines.reduce((sum, line) => add(sum, line.tax[key]), money(0))]),
  ) as RefundSnapshot["totals"];
  // A sale paid on account takes the refund back onto the account first, then hands redeemed points back; only the
  // rest is paid out.
  const tendered = (kind: "credit" | "loyalty") =>
    original.sale.tenders.filter((tender) => tender.kind === kind);
  const charged = tendered("credit").reduce((sum, tender) => add(sum, tender.amount), money(0));
  const [loyalty] = tendered("loyalty");
  const share = allocateRefund(
    totals.gross,
    { charged, credited: original.accountCredited },
    {
      redeemed: loyalty ? { points: loyalty.points!, value: loyalty.amount } : null,
      returned: original.pointsReturned,
    },
  );
  const payout = refundPayout({
    kind: request.tender.kind,
    priorCash: original.cashRefunded,
    gross: sub(sub(totals.gross, share.account), share.pointsValue),
    rounding,
  });
  return {
    ...stamp,
    id: ids.id ?? v7(),
    originalSaleId: original.sale.id,
    creditNoteNumber: ids.creditNoteNumber ?? null,
    reason: request.reason,
    approverId: request.approverId,
    lines,
    totals,
    cashRounding: payout.cashRounding,
    total: payout.total,
    accountCredit: share.account,
    pointsReturned: share.points,
    pointsValue: share.pointsValue,
    tender: request.tender,
  };
}
