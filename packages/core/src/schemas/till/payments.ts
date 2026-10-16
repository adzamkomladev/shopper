import * as v from "valibot";
import { editDraftInput } from "./drafts";
import { momoView, phoneFingerprintSchema } from "../../payments/schemas/momo";
export const draftPaymentInput = v.strictObject({
  ...editDraftInput.entries,
  phoneFingerprint: v.optional(phoneFingerprintSchema),
  ...momoView.entries,
  failureReason: v.optional(momoView.entries.failureReason, null),
});
export const paymentUpdateInput = v.strictObject({
  scope: editDraftInput.entries.scope,
  at: editDraftInput.entries.at,
  ...momoView.entries,
});
