import { orderReportLine, type onlineOrder, type ShopperTransaction } from "@shopper/db-pg";
import type { TaxSnapshot } from "@shopper/tax";
import { touchStoreDay } from "../reports/rollup";

type Order = typeof onlineOrder.$inferSelect;
type Line = { productId: string | null; tax: TaxSnapshot };

/**
 * Writes what an online order sold or gave back as the reports count it, inside the command that invoiced or credited
 * it, and marks its store day stale so the next rollup folds it again. Written for every shop, VAT registered or not.
 */
export async function recordReportLines(
  tx: ShopperTransaction,
  orgId: string,
  order: Order,
  lines: Line[],
  as: {
    source: "order" | "adjustment" | "refund";
    kind: "sale" | "refund";
    tender: "card" | "momo";
    at: Date;
  },
) {
  if (lines.length === 0) return;
  await tx.insert(orderReportLine).values(
    lines.map((line) => ({
      orgId,
      orderId: order.id,
      storeId: order.storeId,
      branchId: order.branchId,
      source: as.source,
      kind: as.kind,
      tender: as.tender,
      productId: line.productId,
      tax: line.tax,
      occurredAt: as.at,
    })),
  );
  await touchStoreDay(tx, orgId, order.storeId, as.at);
}
