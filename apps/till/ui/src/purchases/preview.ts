import { add, money } from "@shopper/money";
import { refundShare } from "@shopper/tax";
import type { PurchaseDetails, RefundPreview } from "../sale/types";

/**
 * What refunding `quantities` (thousandths by line id) takes back, from the sold tax snapshot and what has
 * already gone back: the same shares the host books. Cash rounding is the host's; this is the lines' gross.
 * Null when the sale's own lines are not available (a purchase read without them).
 */
export function previewRefund(
  purchase: PurchaseDetails,
  quantities: Record<string, number>,
): RefundPreview | null {
  const sale = purchase.sale;
  if (!sale || !purchase.eligibility) return null;
  const refunded = new Map(
    purchase.eligibility.lines.map((line) => [line.lineId, line.refundedThousandths]),
  );
  let preview: RefundPreview = { base: money(0), tax: money(0), gross: money(0) };
  for (const line of sale.lines) {
    const quantity = quantities[line.id] ?? 0;
    if (quantity <= 0) continue;
    const before = refunded.get(line.id) ?? 0;
    const share = refundShare(line.tax, before, before + quantity);
    preview = {
      base: add(preview.base, share.base),
      tax: add(preview.tax, add(add(share.vat, share.nhil), add(share.getfund, share.covid))),
      gross: add(preview.gross, share.gross),
    };
  }
  return preview;
}
