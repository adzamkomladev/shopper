import { and, count, eq, gt, inArray } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import {
  invitation,
  kycCase,
  member,
  permission,
  role,
  rolePermission,
  type ShopperTransaction,
} from "@shopper/db-pg";
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

/**
 * Deletes a custom role nobody holds: no member, pending invitation or open KYC case. The row is archived, not
 * removed, because past cashier sessions, KYC cases and invitations still name it; it is never granted again.
 */
export const deleteRole = defineCommand({
  name: "auth.role.delete",
  async run(tx, context, rawId: string) {
    const id = v.parse(uuidV7Schema, rawId).toLowerCase();
    await assertHasPermission(tx, context, "role.write");
    // Locks the role so a concurrent assignment waits for the delete instead of racing it.
    await tx
      .select({ id: role.id })
      .from(role)
      .where(and(eq(role.orgId, context.orgId), eq(role.id, id)))
      .for("update");
    const before = await readRole(tx, context.orgId, id);
    if (before.protectedOwner)
      throw new AdministrationError("The owner role cannot be deleted", 403);
    await assertCanGrantRole(tx, context, id);
    const [[members], [invitations], [cases]] = await Promise.all([
      tx
        .select({ n: count() })
        .from(member)
        .where(and(eq(member.orgId, context.orgId), eq(member.roleId, id))),
      tx
        .select({ n: count() })
        .from(invitation)
        .where(
          and(
            eq(invitation.orgId, context.orgId),
            eq(invitation.roleId, id),
            eq(invitation.status, "pending"),
            gt(invitation.expiresAt, new Date()),
          ),
        ),
      tx
        .select({ n: count() })
        .from(kycCase)
        .where(
          and(
            eq(kycCase.orgId, context.orgId),
            eq(kycCase.requestedRoleId, id),
            inArray(kycCase.status, ["otp_sent", "id_needed", "review"]),
          ),
        ),
    ]);
    const uses = [
      plural(members!.n, "member"),
      plural(invitations!.n, "pending invitation"),
      plural(cases!.n, "open identity check"),
    ].filter(Boolean);
    if (uses.length) throw new AdministrationError(`Used by ${uses.join(" and ")}`, 409);
    await tx
      .delete(rolePermission)
      .where(and(eq(rolePermission.orgId, context.orgId), eq(rolePermission.roleId, id)));
    await tx
      .update(role)
      .set({ archivedAt: new Date() })
      .where(and(eq(role.orgId, context.orgId), eq(role.id, id)));
    return { before, after: null };
  },
  audit: (_input, output) => ({ roleId: output.before.id }),
  details: (_input, output) => ({ entity: "role", entityId: output.before.id, ...output }),
});

/** "2 members", "1 pending invitation", or "" for none. */
const plural = (n: number, word: string) => (n ? `${n} ${word}${n === 1 ? "" : "s"}` : "");

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
