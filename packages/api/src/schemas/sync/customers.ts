import * as v from "valibot";
import { managementId } from "@shopper/core/management";

export const customerUpload = v.strictObject({
  requestId: managementId,
  customer: v.unknown(),
  proof: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
});
