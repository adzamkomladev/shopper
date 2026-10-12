import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

const id = uuidV7Schema;
const pin = v.pipe(v.string(), v.regex(/^\d{4,8}$/));
export const enrollmentIssueInput = v.strictObject({ branchId: id });
export const enrollmentInput = v.strictObject({
  orgId: id,
  code: v.pipe(v.string(), v.regex(/^\d{6}$/)),
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
});
export const pinInput = v.strictObject({ userId: id, pin });
export const cashierLoginInput = v.strictObject({
  deviceId: id,
  deviceToken: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
  userId: id,
  pin,
});
export const revokeDeviceInput = v.strictObject({ deviceId: id });
export const deviceListItem = v.strictObject({
  id,
  name: v.string(),
  branchId: id,
  branchName: v.string(),
  createdAt: v.string(),
  revokedAt: v.nullable(v.string()),
  status: v.picklist(["active", "revoked"]),
});
export const deviceListResponse = v.array(deviceListItem);
