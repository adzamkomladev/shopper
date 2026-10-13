import * as v from "valibot";
import { tillId } from "./fields";

export const tillSession = v.strictObject({
  id: tillId,
  orgId: tillId,
  deviceId: tillId,
  branchId: tillId,
  userId: tillId,
  roleName: v.string(),
  issuedAt: v.pipe(v.string(), v.isoTimestamp()),
  expiresAt: v.pipe(v.string(), v.isoTimestamp()),
  permissions: v.array(v.string()),
  proof: v.pipe(v.string(), v.minLength(1)),
});
export type TillSession = v.InferOutput<typeof tillSession>;
