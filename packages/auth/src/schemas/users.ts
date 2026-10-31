import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

export const assignRoleInput = v.strictObject({ userId: uuidV7Schema, roleId: uuidV7Schema });
/** `PUT /users/:id/branches`: the branches a member is limited to; empty lifts the limit. */
export const memberBranchesInput = v.strictObject({
  branchIds: v.pipe(v.array(uuidV7Schema), v.maxLength(200)),
});
export const registerUserInput = v.strictObject({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
  email: v.pipe(v.string(), v.trim(), v.email()),
  password: v.pipe(v.string(), v.minLength(8), v.maxLength(128)),
  roleId: uuidV7Schema,
});

export const userListItem = v.object({
  id: uuidV7Schema,
  name: v.string(),
  email: v.string(),
  emailVerified: v.boolean(),
  roleId: uuidV7Schema,
  roleName: v.string(),
  protectedOwner: v.boolean(),
  /** When the member was deactivated (ISO), or null while active. */
  deactivatedAt: v.nullable(v.string()),
  /** Until when a run of wrong PINs or passwords locks the member out (ISO), or null when it does not. */
  lockedUntil: v.nullable(v.string()),
  /** The branches the member is limited to; empty means every branch. */
  branchIds: v.array(uuidV7Schema),
});
export const userListResponse = v.array(userListItem);
