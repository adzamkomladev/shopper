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
  /** Set on an offline session: the server session it follows from, whose proof prefixes its own. */
  parentSessionId: v.optional(v.nullable(tillId)),
});
export type TillSession = v.InferOutput<typeof tillSession>;

/** What travels beside an offline session's proof so the server can adopt it under its parent. */
export const offlineSession = v.strictObject({
  parentSessionId: tillId,
  issuedAt: v.pipe(v.string(), v.isoTimestamp()),
  expiresAt: v.pipe(v.string(), v.isoTimestamp()),
  permissions: v.pipe(v.array(v.pipe(v.string(), v.maxLength(64))), v.maxLength(64)),
});
export type OfflineSession = v.InferOutput<typeof offlineSession>;

/** Manager permissions an offline session never carries: they wait until the server can be asked. */
export const offlineWithheld = [
  "refund.approve",
  "register.settings",
  "sale.discount",
  "sale.price_override",
  "sale.void",
  "shift.approve",
];
