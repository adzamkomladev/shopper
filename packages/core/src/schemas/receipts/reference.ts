import * as v from "valibot";

export const receiptReference = v.strictObject({
  orgName: v.optional(v.string()),
  tin: v.optional(v.nullable(v.string())),
  branchName: v.optional(v.string()),
  address: v.optional(v.nullable(v.string())),
  deviceName: v.optional(v.string()),
  cashierName: v.optional(v.string()),
  footer: v.optional(v.string()),
});
export type ReceiptReference = v.InferOutput<typeof receiptReference> & {
  tenderPhones?: Record<string, string>;
};
