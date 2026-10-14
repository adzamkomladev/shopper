import * as v from "valibot";

import { uuidV7Schema } from "@shopper/ports";

export const authFlowParamsSchema = v.variant("purpose", [
  v.strictObject({ purpose: v.literal("registration"), id: uuidV7Schema }),
  v.strictObject({ purpose: v.literal("invitation"), id: uuidV7Schema, orgId: uuidV7Schema }),
]);
export const deliveryOutcomeSchema = v.strictObject({
  active: v.boolean(),
  expired: v.boolean(),
  expiresAt: v.string(),
  sent: v.boolean(),
});
export type AuthFlowParams = v.InferOutput<typeof authFlowParamsSchema>;

export const authFlowAction = v.strictObject({ action: v.picklist(["retry", "completed"]) });
