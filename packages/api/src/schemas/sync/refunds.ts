import * as v from "valibot";
import { managementId } from "@shopper/core/management";

export const refundUpload = v.strictObject({
  requestId: managementId,
  refund: v.unknown(),
  proof: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
});
export const saleLookup = v.strictObject({
  receipt: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(64)),
});
