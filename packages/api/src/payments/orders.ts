import { eq } from "drizzle-orm";
import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import { applyOrderPaymentEvent, applyOrderRefundEvent } from "@shopper/core/orders";
import { orderPayment } from "@shopper/db-pg";
import { uuidV7Schema } from "@shopper/ports";
import type { Money } from "@shopper/money";
import type { ApiOptions } from "../types";

type Report = {
  provider: "paystack" | "hubtel";
  key: string;
  kind: string;
  reference: string;
  status: "confirmed" | "failed";
  /** What the provider says it collected; money that differs from the attempt's amount is refused. */
  amount?: Money;
  providerReference?: string;
  message?: string;
};

/** Whether the reference names an online order's payment attempt (rather than a till's payment). */
export async function isOrderPayment(options: ApiOptions, reference: string) {
  if (!options.database || !v.safeParse(uuidV7Schema, reference).success) return false;
  const [row] = await options.database
    .select({ id: orderPayment.id })
    .from(orderPayment)
    .where(eq(orderPayment.id, reference));
  return Boolean(row);
}

/**
 * A provider's word on an online order's payment. `none` when the reference is not an order payment (the caller
 * tries the till's payments next); `mismatch` when the amount differs from the attempt's; otherwise it is applied
 * once, and the order's and the attempt's workflows are woken.
 */
export async function orderPaymentReport(options: ApiOptions, report: Report) {
  if (!options.database || !v.safeParse(uuidV7Schema, report.reference).success) return "none";
  const [row] = await options.database
    .select()
    .from(orderPayment)
    .where(eq(orderPayment.id, report.reference));
  if (!row) return "none";
  if (report.status === "confirmed" && report.amount !== undefined && report.amount !== row.amount)
    return "mismatch";
  const applied = await applyOrderPaymentEvent(
    options.database,
    { orgId: row.orgId, appVersion: buildInfo.version, queue: options.notifications },
    report,
  );
  if (applied.duplicate) return "applied";
  if (applied.outcome === "settled")
    await options.orderFlows?.send(applied.orderId, "payment.settled", { reference: row.id });
  await options.orderPayments?.send(row.id, "payment", { type: "settled" });
  return "applied";
}

/** A Paystack `refund.*` webhook for an online order's payment; false when it is not one of ours. */
export async function orderRefundReport(
  options: ApiOptions,
  event: {
    event: "refund.processed" | "refund.failed";
    reference: string;
    id?: string | number;
    refundReference?: string | null;
  },
) {
  if (!options.database || !v.safeParse(uuidV7Schema, event.reference).success) return false;
  const [row] = await options.database
    .select({ orgId: orderPayment.orgId })
    .from(orderPayment)
    .where(eq(orderPayment.id, event.reference));
  if (!row) return false;
  await applyOrderRefundEvent(
    options.database,
    { orgId: row.orgId, appVersion: buildInfo.version },
    {
      key: `${event.event}:${event.id ?? event.refundReference ?? event.reference}`,
      kind: event.event,
      reference: event.reference,
    },
  );
  return true;
}
