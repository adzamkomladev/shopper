import * as v from "valibot";
import { managementId } from "@shopper/core/management";
import { sessionCredential } from "./session";

export const customerUpload = v.strictObject({
  requestId: managementId,
  customer: v.unknown(),
  ...sessionCredential,
});
export const holdUpload = v.strictObject({
  requestId: managementId,
  hold: v.unknown(),
  ...sessionCredential,
});
export const holdReleaseUpload = v.strictObject({
  requestId: managementId,
  release: v.unknown(),
  ...sessionCredential,
});
export const accountReadUpload = v.strictObject({
  session: v.unknown(),
  ...sessionCredential,
});
export const accountPaymentUpload = v.strictObject({
  requestId: managementId,
  payment: v.unknown(),
  ...sessionCredential,
});
