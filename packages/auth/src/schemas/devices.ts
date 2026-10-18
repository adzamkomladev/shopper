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
export const enrollmentResult = v.object({
  deviceId: id,
  branchId: id,
  deviceToken: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
  receiptCodes: v.unknown(),
});
export const parseEnrollmentResult = (data: unknown) => v.parse(enrollmentResult, data);
export const isEnrollmentCode = (code: string) => v.is(enrollmentInput.entries.code, code);
export const pinInput = v.strictObject({ userId: id, pin });
const deviceLogin = {
  deviceId: id,
  deviceToken: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
};
export const cashierLoginInput = v.union([
  v.strictObject({ ...deviceLogin, userId: id, pin }),
  v.strictObject({
    ...deviceLogin,
    email: v.pipe(v.string(), v.trim(), v.email(), v.maxLength(320)),
    password: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
  }),
]);
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
