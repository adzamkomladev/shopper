import { and, eq, inArray } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { permission, role, rolePermission, type ShopperTransaction } from "@shopper/db-pg";
import { uuidV7Schema } from "@shopper/ports";
import { createRoleInput, updateRoleInput } from "../schemas/roles";
import {
  AdministrationError,
  assertCanGrantRole,
  assertHasPermission,
  grantedCodes,
} from "./service";
import { readRole } from "../administration";

export const createRole = defineCommand({
  name: "auth.role.create",
  async run(tx, context, rawInput: unknown) {
    const input = v.parse(createRoleInput, rawInput);
    await assertHasPermission(tx, context, "role.write");
    await assertGrantCeiling(tx, context, input.permissionCodes);
    const [created] = await tx
      .insert(role)
      .values({ orgId: context.orgId, name: input.name })
      .returning();
    if (!created) throw new Error("Role creation failed");
    await replacePermissions(tx, context.orgId, created.id, input.permissionCodes);
    return { before: null, after: await readRole(tx, context.orgId, created.id) };
  },
  audit: (_input, output) => ({ roleId: output.after.id }),
  details: (_input, output) => ({ entity: "role", entityId: output.after.id, ...output }),
});

export const updateRole = defineCommand({
  name: "auth.role.update",
  async run(tx, context, rawInput: { id: string; data: unknown }) {
    const id = v.parse(uuidV7Schema, rawInput.id).toLowerCase();
    const input = v.parse(updateRoleInput, rawInput.data);
    await assertHasPermission(tx, context, "role.write");
    const before = await readRole(tx, context.orgId, id);
    if (before.protectedOwner)
      throw new AdministrationError("The owner role cannot be edited", 403);
    await assertCanGrantRole(tx, context, id);
    if (input.permissionCodes) {
      await assertGrantCeiling(tx, context, input.permissionCodes);
      await replacePermissions(tx, context.orgId, id, input.permissionCodes);
    }
    if (input.name !== undefined)
      await tx
        .update(role)
        .set({ name: input.name })
        .where(and(eq(role.orgId, context.orgId), eq(role.id, id)));
    return { before, after: await readRole(tx, context.orgId, id) };
  },
  audit: (_input, output) => ({ roleId: output.after.id }),
  details: (_input, output) => ({ entity: "role", entityId: output.after.id, ...output }),
});

async function assertGrantCeiling(
  tx: ShopperTransaction,
  context: Parameters<typeof assertHasPermission>[1],
  codes: string[],
) {
  const granted = await grantedCodes(tx, context.orgId, context.actorId!, {
    deviceId: context.deviceId,
  });
  const ceiling = new Set(granted.map(({ code }) => code));
  if (codes.some((code) => !ceiling.has(code)))
    throw new AdministrationError("Cannot grant permissions you do not hold", 403);
}

async function replacePermissions(
  tx: ShopperTransaction,
  orgId: string,
  roleId: string,
  codes: string[],
) {
  await tx
    .delete(rolePermission)
    .where(and(eq(rolePermission.orgId, orgId), eq(rolePermission.roleId, roleId)));
  if (!codes.length) return;
  const rows = await tx
    .select({ id: permission.id })
    .from(permission)
    .where(and(eq(permission.orgId, orgId), inArray(permission.code, [...new Set(codes)])));
  if (rows.length !== new Set(codes).size) throw new AdministrationError("Unknown permission", 400);
  await tx
    .insert(rolePermission)
    .values(rows.map(({ id }) => ({ orgId, roleId, permissionId: id })));
}
