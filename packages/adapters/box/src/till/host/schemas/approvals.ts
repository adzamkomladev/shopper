import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

/** The server's view of a remote approval, as `GET /approvals/:id` and the live push carry it. */
export const serverApproval = v.object({
  id: uuidV7Schema,
  kind: v.picklist(["refund", "discount"]),
  deviceId: uuidV7Schema,
  status: v.picklist(["pending", "approved", "declined", "expired"]),
  decidedBy: v.nullable(uuidV7Schema),
  declineReason: v.nullable(v.string()),
  expiresAt: v.pipe(v.string(), v.isoTimestamp()),
  /** What the manager approved: one sale's refund of exactly `amount`. */
  subject: v.object({ saleId: v.optional(uuidV7Schema), amount: v.number() }),
  consumed: v.boolean(),
});
