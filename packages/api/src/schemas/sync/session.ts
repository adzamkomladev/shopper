import * as v from "valibot";
import { offlineSession } from "@shopper/core/schemas";

/** The cashier session a till request acts under; an offline one carries what adopts it. */
export const sessionCredential = {
  proof: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
  offline: v.optional(offlineSession),
};
export const sessionUpload = v.strictObject({
  ...sessionCredential,
  offline: offlineSession,
});
