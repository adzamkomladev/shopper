import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

export const identityId = v.pipe(
  uuidV7Schema,
  v.transform((id) => id.toLowerCase()),
);
/** Which shop, store, branch and device a till is, as enrolment set it. */
export const registerIdentity = v.strictObject({
  orgId: identityId,
  deviceId: identityId,
  storeId: identityId,
  branchId: identityId,
  shopName: v.pipe(v.string(), v.minLength(1)),
  registerName: v.pipe(v.string(), v.minLength(1)),
});
