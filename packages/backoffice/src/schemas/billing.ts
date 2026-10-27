import * as v from "valibot";

export const invoiceRow = v.object({
  id: v.string(),
  reference: v.string(),
  periodStart: v.string(),
  periodEnd: v.string(),
  stores: v.number(),
  terminals: v.number(),
  amount: v.number(),
  status: v.picklist(["open", "paid", "void"]),
  checkoutUrl: v.nullable(v.string()),
  reminders: v.number(),
  paidAt: v.nullable(v.string()),
});
export type InvoiceRow = v.InferOutput<typeof invoiceRow>;

export const billingView = v.object({
  subscription: v.nullable(
    v.object({
      status: v.picklist(["active", "past_due", "read_only"]),
      billingDay: v.number(),
      nextInvoiceOn: v.string(),
    }),
  ),
  invoices: v.array(invoiceRow),
});
export type BillingView = v.InferOutput<typeof billingView>;

export const billingStatus = v.object({ readOnly: v.boolean() });
