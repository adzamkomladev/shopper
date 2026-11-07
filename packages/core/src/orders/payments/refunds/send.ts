import { and, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { orderPayment, orderRefund } from "@shopper/db-pg";
import { PaystackError } from "../../../payments/paystack/errors";
import type { OrderRefundDeps } from "../../types";

/**
 * Sends one owed refund back to the payer, once. Paystack refunds are requested here and settled by their webhook;
 * Hubtel has no refund API in our client, so its refunds wait as `refund_due` for the store to send by hand. A
 * refused request is final; an interrupted one stays pending for someone to check, never repeated.
 */
export async function refundOrderPayment(deps: OrderRefundDeps, id: string, orgId: string) {
  const row = await deps.withDatabase(async (db) => {
    const [found] = await db
      .select({ refund: orderRefund, payment: orderPayment })
      .from(orderRefund)
      .innerJoin(
        orderPayment,
        and(
          eq(orderPayment.orgId, orderRefund.orgId),
          eq(orderPayment.id, orderRefund.orderPaymentId),
        ),
      )
      .where(and(eq(orderRefund.orgId, orgId), eq(orderRefund.id, id)));
    return found;
  });
  if (!row || row.refund.status !== "pending") return;
  const context = { orgId, appVersion: deps.appVersion };
  if (row.payment.provider === "hubtel" || !deps.paystack)
    return void (await deps.withDatabase((db) =>
      recordRefund(db, context, {
        id,
        from: "pending",
        status: "refund_due",
        reason: "Send this refund from your Hubtel dashboard.",
      }),
    ));
  // Claimed before Paystack is asked, so a redelivery or a concurrent consumer can never ask twice.
  const claimed = await deps.withDatabase((db) =>
    recordRefund(db, context, { id, from: "pending", status: "requested" }),
  );
  if (!claimed.changed) return;
  const result = await deps.paystack
    .refund({ reference: row.payment.id, amount: row.refund.amount })
    .then((sent) => ({
      status: sent.status === "pending" ? ("requested" as const) : sent.status,
      providerReference: sent.providerReference,
      reason: undefined,
    }))
    .catch((error: unknown) =>
      error instanceof PaystackError && error.httpStatus < 500
        ? { status: "failed" as const, reason: error.message, providerReference: undefined }
        : {
            status: "requested" as const,
            reason: "The refund request did not complete. Check Paystack before refunding again.",
            providerReference: undefined,
          },
    );
  await deps.withDatabase((db) => recordRefund(db, context, { id, from: "requested", ...result }));
}

const recordRefund = defineCommand({
  name: "order.refund.recorded",
  async run(
    tx,
    ctx,
    input: {
      id: string;
      /** The status it must still have: a second writer finds it moved and changes nothing. */
      from: "pending" | "requested";
      status: "requested" | "processed" | "failed" | "refund_due";
      providerReference?: string;
      reason?: string;
    },
  ) {
    const moved = await tx
      .update(orderRefund)
      .set({
        status: input.status,
        providerReference: input.providerReference ?? null,
        failureReason: input.reason ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orderRefund.orgId, ctx.orgId),
          eq(orderRefund.id, input.id),
          eq(orderRefund.status, input.from),
        ),
      )
      .returning({ id: orderRefund.id });
    return { changed: moved.length > 0 };
  },
  audit: (input, output) => ({ id: input.id, status: input.status, ...output }),
  details: (input) => ({ entity: "order_refund", entityId: input.id }),
});
