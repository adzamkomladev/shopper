import type { onlineOrder, onlineOrderLine, ShopperTransaction } from "@shopper/db-pg";
import { quoteCart } from "../../storefront/cart";

/** The paid lines the box's own quote now prices (version or gross) differently. */
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
    if (quoted.priceId === line.priceId && quoted.tax?.gross === line.gross) return [];
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
