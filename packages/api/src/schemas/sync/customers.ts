import * as v from "valibot";
import { managementId } from "@shopper/core/management";

export const customerUpload = v.strictObject({
  requestId: managementId,
  customer: v.unknown(),
  proof: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
});
export const holdUpload = v.strictObject({
  requestId: managementId,
  hold: v.unknown(),
  proof: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
});
export const holdReleaseUpload = v.strictObject({
  requestId: managementId,
  release: v.unknown(),
  proof: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
});
