import type { onlineOrder, onlineOrderLine, ShopperTransaction } from "@shopper/db-pg";
import { quoteCart } from "../../storefront/cart";

/** What the customer paid, line by line: a change to any of it (price or any tax) is flagged. */
const amounts = ["base", "vat", "nhil", "getfund", "covid", "gross"] as const;
type Amount = (typeof amounts)[number];

/** The paid lines the box's own quote now prices or taxes differently (price version, gross or any levy). */
export async function checkPrices(
  tx: ShopperTransaction,
  orgId: string,
  order: typeof onlineOrder.$inferSelect,
  lines: (typeof onlineOrderLine.$inferSelect & { productId: string })[],
  now: Date,
) {
  const quote = await quoteCart(
    tx,
    orgId,
    {
      branch: order.branchId,
      fulfilment: "pickup",
      lines: lines.map((line) => ({
        productId: line.productId,
        quantityThousandths: line.quantityThousandths,
      })),
    },
    now,
  );
  return lines.flatMap((line, index) => {
    const quoted = quote.lines[index]!;
    const paid = (line.payload as { tax: Record<Amount, number> }).tax;
    if (quoted.priceId === line.priceId && amounts.every((key) => quoted.tax?.[key] === paid[key]))
      return [];
    return [
      {
        lineId: line.id,
        name: (line.payload as { name: string }).name,
        paidPriceId: line.priceId,
        paid: line.gross,
        priceId: quoted.priceId,
        now: quoted.tax?.gross ?? null,
      },
    ];
  });
}
