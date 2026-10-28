import * as v from "valibot";
import { managementId } from "@shopper/core/management";
import { sessionCredential } from "./session";

export const shiftUpload = v.strictObject({
  requestId: managementId,
  shift: v.unknown(),
  ...sessionCredential,
});
