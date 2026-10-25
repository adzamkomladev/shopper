import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

const day = v.pipe(v.string(), v.isoDate());

/** One org's anchor for one UTC day. */
export const auditAnchorParams = v.strictObject({ orgId: uuidV7Schema, day });

/** The queued email to one owner naming the day's anchors. */
export const auditAnchorMessage = v.looseObject({
  type: v.literal("audit.anchor"),
  v: v.literal(1),
  orgId: uuidV7Schema,
  payload: v.strictObject({ day, userId: v.pipe(v.string(), v.uuid()) }),
});
