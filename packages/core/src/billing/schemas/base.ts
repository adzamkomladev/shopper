import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

const isoDay = v.pipe(v.string(), v.isoDate());

/** One billing period's workflow: raised on `periodStart`, dunned until paid or read-only. */
export const billingParams = v.object({ orgId: uuidV7Schema, periodStart: isoDay });

/** An invoice email to the owner: raised, a reminder, or the back office turning read-only. */
export const invoiceMessage = v.object({
  type: v.picklist(["invoice.issued", "invoice.reminder", "invoice.read_only"]),
  payload: v.object({ invoiceId: uuidV7Schema, userId: uuidV7Schema }),
});

/** The Paystack checkout's webhook, carrying the invoice as its reference. */
export const invoiceCharge = v.object({
  reference: uuidV7Schema,
  amount: v.pipe(v.number(), v.safeInteger()),
});
