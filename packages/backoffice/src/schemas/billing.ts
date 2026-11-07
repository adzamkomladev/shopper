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

const licenceState = {
  state: v.picklist(["valid", "grace", "locked"]),
  reason: v.optional(v.picklist(["missing", "unreadable", "forged", "machine", "expired"])),
  locksAt: v.optional(v.string()),
};

/** The box's licence: where it stands, its terms when readable, and the code Shopper issues one from. */
export const licenceView = v.object({
  ...licenceState,
  checkedInAt: v.optional(v.string()),
  licence: v.optional(
    v.object({
      id: v.string(),
      site: v.string(),
      terminals: v.number(),
      maintenanceUntil: v.string(),
    }),
  ),
  request: v.string(),
  error: v.optional(v.string()),
});
export type LicenceView = v.InferOutput<typeof licenceView>;

export const billingView = v.object({
  subscription: v.nullable(
    v.object({
      status: v.picklist(["active", "past_due", "read_only"]),
      billingDay: v.number(),
      nextInvoiceOn: v.string(),
    }),
  ),
  invoices: v.array(invoiceRow),
  licence: v.nullish(licenceView),
});
export type BillingView = v.InferOutput<typeof billingView>;

export const billingStatus = v.object({
  readOnly: v.boolean(),
  licence: v.nullish(v.object(licenceState)),
});
