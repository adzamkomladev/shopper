import { and, eq, isNull } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { branch, product, stockAlert, type ShopperDatabase } from "@shopper/db-pg";
import type { Delivery } from "@shopper/ports";
import { formatQuantity } from "@shopper/utils";
import { stockAlertMessage } from "../../schemas/stock/alerts";
import type { Sms } from "../../sms/types";

/**
 * Texts a raised alert to its branch's alert phones, once. A cleared or already sent alert, or a
 * branch with no phones, is acknowledged without sending; any failure is retried.
 * The send precedes the audited `sent_at` write, so a crash between them can text twice, never zero.
 */
export async function deliverStockAlert(
  db: ShopperDatabase,
  sms: Sms,
  delivery: Delivery,
  appVersion: string,
) {
  try {
    const { orgId, payload } = v.parse(stockAlertMessage, delivery.message);
    const [row] = await db
      .select({
        alert: stockAlert,
        branchName: branch.name,
        phones: branch.alertPhones,
        productName: product.name,
        baseUnit: product.baseUnit,
      })
      .from(stockAlert)
      .innerJoin(
        branch,
        and(eq(branch.orgId, stockAlert.orgId), eq(branch.id, stockAlert.branchId)),
      )
      .innerJoin(
        product,
        and(eq(product.orgId, stockAlert.orgId), eq(product.id, stockAlert.productId)),
      )
      .where(and(eq(stockAlert.orgId, orgId), eq(stockAlert.id, payload.alertId)));
    // ponytail: with no phones the alert stays unsent, and phones added later do not resend it until a watchdog re-send exists.
    if (!row || row.alert.clearedAt || row.alert.sentAt || !row.phones.length)
      return await delivery.ack();
    const unit = row.baseUnit === "each" ? "" : ` ${row.baseUnit}`;
    await sms.send(
      row.phones,
      `Low stock: ${row.productName} at ${row.branchName}, ` +
        `${formatQuantity(row.alert.onHandThousandths, "-")}${unit} left, ` +
        `reorder at ${formatQuantity(row.alert.levelThousandths)}${unit}.`,
    );
    await markSent(db, { orgId, appVersion }, { alertId: payload.alertId });
    await delivery.ack();
  } catch (error) {
    console.error({ event: "stock.alert.deliver_failed", attempts: delivery.attempts, error });
    await delivery.retry();
  }
}

const markSent = defineCommand({
  name: "stock.alert.sent",
  async run(tx, ctx, input: { alertId: string }) {
    const marked = await tx
      .update(stockAlert)
      .set({ sentAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(stockAlert.orgId, ctx.orgId),
          eq(stockAlert.id, input.alertId),
          isNull(stockAlert.sentAt),
        ),
      )
      .returning({ id: stockAlert.id });
    return { alertId: input.alertId, marked: marked.length === 1 };
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({ entity: "stock_alert", entityId: output.alertId }),
});
