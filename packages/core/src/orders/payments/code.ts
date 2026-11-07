import { and, eq, inArray } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { orderPayment } from "@shopper/db-pg";

/**
 * A mobile money attempt whose network asked for a one-time code: it waits for the shopper to give it (`otp`), with the
 * reason the last code was refused, if one was, or goes back to waiting on the phone (`pending`) once a code is taken.
 * Only an open attempt moves.
 */
export const awaitOrderPaymentCode = defineCommand({
  name: "order.payment.code",
  async run(tx, context, input: { id: string; status: "otp" | "pending"; reason?: string }) {
    const waiting = await tx
      .update(orderPayment)
      .set({ status: input.status, failureReason: input.reason ?? null, updatedAt: new Date() })
      .where(
        and(
          eq(orderPayment.orgId, context.orgId),
          eq(orderPayment.id, input.id),
          inArray(orderPayment.status, ["pending", "otp"]),
        ),
      )
      .returning({ id: orderPayment.id });
    return { waiting: waiting.length > 0 };
  },
  audit: (input, output) => ({
    id: input.id,
    status: input.status,
    reason: input.reason ?? null,
    ...output,
  }),
  details: (input) => ({ entity: "order_payment", entityId: input.id }),
});
