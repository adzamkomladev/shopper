import * as v from "valibot";
import { managementId } from "@shopper/core/management";
import { sessionCredential } from "./session";

export const refundUpload = v.strictObject({
  requestId: managementId,
  refund: v.unknown(),
  ...sessionCredential,
});
export const saleLookup = v.strictObject({
  receipt: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(64)),
});
