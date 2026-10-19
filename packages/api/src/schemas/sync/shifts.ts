import * as v from "valibot";
import { managementId } from "@shopper/core/management";

export const shiftUpload = v.strictObject({
  requestId: managementId,
  shift: v.unknown(),
  proof: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
});
