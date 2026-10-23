import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { customerId } from "./inputs";

/** A tier downgrade notice to send; the consumer reads everything else from the row. */
export const tierNoticeMessage = v.looseObject({
  type: v.literal("tier.notice"),
  v: v.literal(1),
  orgId: uuidV7Schema,
  payload: v.strictObject({ noticeId: uuidV7Schema }),
});

/** Start or wake one customer's account workflow. */
export const accountWakeMessage = v.looseObject({
  type: v.literal("account.wake"),
  v: v.literal(1),
  orgId: uuidV7Schema,
  payload: v.strictObject({ customerId }),
});

/** An org's posting settings changed: wake every account they may touch. */
export const accountSettingsMessage = v.looseObject({
  type: v.literal("account.settings"),
  v: v.literal(1),
  orgId: uuidV7Schema,
});

/** What the account workflow starts with; its instance id is the customer id. */
export const accountFlowParams = v.strictObject({ orgId: uuidV7Schema, customerId });
