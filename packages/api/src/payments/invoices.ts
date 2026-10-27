import { eq } from "drizzle-orm";
import { buildInfo } from "@shopper/config";
import { billingId, payInvoice } from "@shopper/core/billing";
import { invoice } from "@shopper/db-pg";
import { money, toPesewas } from "@shopper/money";
import type { PaystackWebhook } from "@shopper/core/payments/paystack";
import type { ApiOptions } from "../types";

/**
 * A Paystack charge for one of Shopper's own invoices, which carry the invoice id as their reference: pays it once
 * and stops the period's dunning. Answers undefined for any other reference, and "mismatch" for a wrong amount.
 */
export async function invoiceWebhook(
  options: ApiOptions,
  charge: Extract<PaystackWebhook, { data: { reference: string } }>,
) {
  const [row] = await options
    .database!.select()
    .from(invoice)
    .where(eq(invoice.reference, charge.data.reference));
  if (!row) return undefined;
  if (charge.event !== "charge.success") return "ignored" as const;
  if (toPesewas(money(row.amount)) !== charge.data.amount) return "mismatch" as const;
  const saved = await payInvoice(
    options.database!,
    { orgId: row.orgId, appVersion: buildInfo.version },
    { id: row.id, key: `charge.success:${row.reference}`, at: new Date() },
  );
  if (saved.paid)
    await options.billing?.send(billingId(row.orgId, row.periodStart), "invoice.paid", {});
  return "paid" as const;
}
