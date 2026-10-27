import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { permissionNames } from "./permissions";

export const permissionCode = v.picklist(permissionNames);
const roleName = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100));
const permissionCodes = v.pipe(v.array(permissionCode), v.maxLength(permissionNames.length));
export const createRoleInput = v.strictObject({ name: roleName, permissionCodes });
export const updateRoleInput = v.pipe(
  v.strictObject({ name: v.optional(roleName), permissionCodes: v.optional(permissionCodes) }),
  v.check(
    (input) => input.name !== undefined || input.permissionCodes !== undefined,
    "A role change is required",
  ),
);
export const roleAssignmentInput = v.strictObject({ roleId: uuidV7Schema });
export const roleListItem = v.object({
  id: uuidV7Schema,
  name: v.string(),
  protectedOwner: v.boolean(),
  permissionCodes: v.array(permissionCode),
  memberCount: v.number(),
});
export const roleListResponse = v.array(roleListItem);
export const permissionListItem = v.object({
  id: uuidV7Schema,
  code: permissionCode,
  tillAllowed: v.boolean(),
});
export const permissionListResponse = v.array(permissionListItem);
export const sessionPermissionsResponse = v.array(permissionCode);
