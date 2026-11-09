import * as v from "valibot";
import { offlineSession } from "@shopper/core/schemas";

/**
 * The cashier session a till request acts under; an offline one carries what adopts it, and `grant` is its server
 * session as the server signed it, which a box restored from an older backup records it again from.
 */
export const sessionCredential = {
  proof: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
  offline: v.optional(offlineSession),
  grant: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(4096))),
};
export const sessionUpload = v.strictObject({
  ...sessionCredential,
  offline: offlineSession,
});
