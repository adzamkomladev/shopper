import * as v from "valibot";

const uuid = v.pipe(
  v.string(),
  v.uuid(),
  v.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
);
export const contextSchema = v.object({
  orgId: uuid,
  actorId: v.optional(uuid),
  role: v.optional(v.string()),
  deviceId: v.optional(uuid),
  branchId: v.optional(uuid),
  approverId: v.optional(uuid),
  reason: v.optional(v.string()),
  deviceTime: v.optional(v.date()),
  appVersion: v.pipe(v.string(), v.minLength(1)),
});
// Pre-shop commands have no customer identity, device, role, approver or branch to report.
export const registrationContextSchema = v.strictObject({
  orgId: uuid,
  appVersion: v.pipe(v.string(), v.minLength(1)),
});
