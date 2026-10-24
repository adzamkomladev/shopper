import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

export const kycFlowParams = v.strictObject({ id: uuidV7Schema, orgId: uuidV7Schema });
/** A wake-up, nothing more: the workflow reads what happened from the case row. */
export const kycFlowAction = v.strictObject({
  action: v.picklist(["resend", "verified", "id", "decided"]),
});
export type KycFlowParams = v.InferOutput<typeof kycFlowParams>;
