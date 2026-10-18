import { and, eq, isNull } from "drizzle-orm";
import type { CommandContext } from "@shopper/audit";
import {
  branch,
  cashierSession,
  device,
  deviceCredential,
  member,
  permission,
  rolePermission,
  type ShopperTransaction,
} from "@shopper/db-pg";
import type { SaleSnapshot } from "../schemas/till/sale";
import { SaleError } from "./error";
import type { UploadPrincipal } from "./types";

/** The enrolled device, a live cashier session of the right member, and the base `permission`, all at `time`. */
export async function sessionAuthority(
  tx: ShopperTransaction,
  ctx: CommandContext,
  principal: UploadPrincipal,
  snapshot: Pick<SaleSnapshot, "sessionId" | "cashierId">,
  proofHash: string,
  time: Date,
  required: string,
) {
  const [registered] = await tx
    .select()
    .from(deviceCredential)
    .innerJoin(
      device,
      and(eq(device.orgId, deviceCredential.orgId), eq(device.id, deviceCredential.deviceId)),
    )
    .innerJoin(branch, and(eq(branch.orgId, device.orgId), eq(branch.id, device.branchId)))
    .where(
      and(
        eq(deviceCredential.orgId, ctx.orgId),
        eq(deviceCredential.deviceId, principal.deviceId),
        eq(device.branchId, principal.branchId),
        eq(branch.storeId, principal.storeId),
        isNull(deviceCredential.revokedAt),
      ),
    );
  const [session] = await tx
    .select()
    .from(cashierSession)
    .where(
      and(
        eq(cashierSession.orgId, ctx.orgId),
        eq(cashierSession.id, snapshot.sessionId),
        eq(cashierSession.deviceId, principal.deviceId),
        eq(cashierSession.branchId, principal.branchId),
        eq(cashierSession.userId, snapshot.cashierId),
        eq(cashierSession.tokenHash, proofHash),
        isNull(cashierSession.revokedAt),
      ),
    );
  const [membership] = await tx
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.orgId, ctx.orgId), eq(member.userId, snapshot.cashierId)));
  if (
    !registered ||
    !session ||
    !membership ||
    !session.permissions.includes(required) ||
    time < session.issuedAt ||
    time >= session.expiresAt
  )
    throw new SaleError("INVALID_SESSION", "Sale lacks valid historical cashier authority");
  return session;
}

/** Whether the member's role holds `code` right now, from role_permission rather than the session snapshot. */
export async function hasGrant(
  tx: ShopperTransaction,
  orgId: string,
  userId: string,
  code: string,
) {
  const [granted] = await tx
    .select({ id: permission.id })
    .from(member)
    .innerJoin(
      rolePermission,
      and(eq(rolePermission.orgId, member.orgId), eq(rolePermission.roleId, member.roleId)),
    )
    .innerJoin(
      permission,
      and(
        eq(permission.orgId, rolePermission.orgId),
        eq(permission.id, rolePermission.permissionId),
      ),
    )
    .where(and(eq(member.orgId, orgId), eq(member.userId, userId), eq(permission.code, code)));
  return !!granted;
}

/**
 * An overridden price needs the cashier session and role, or the named approver's role, to hold
 * `sale.price_override`. Sets the audit approver when every override names the same one.
 */
export async function overrideAuthority(
  tx: ShopperTransaction,
  ctx: CommandContext,
  session: { permissions: string[] },
  snapshot: SaleSnapshot,
) {
  for (const { approverId } of overrideList(snapshot)) {
    const allowed = approverId
      ? await hasGrant(tx, ctx.orgId, approverId, "sale.price_override")
      : session.permissions.includes("sale.price_override") &&
        (await hasGrant(tx, ctx.orgId, snapshot.cashierId, "sale.price_override"));
    if (!allowed)
      throw new SaleError("INVALID_SESSION", "Price override lacks approver permission");
  }
  const [only, ...others] = overrideApprovers(snapshot);
  if (only && !others.length) ctx.approverId = only;
}

const overrideList = (snapshot: SaleSnapshot) =>
  snapshot.lines.flatMap((line) => (line.override ? [{ lineId: line.id, ...line.override }] : []));
const overrideApprovers = (snapshot: SaleSnapshot) => [
  ...new Set(overrideList(snapshot).flatMap(({ approverId }) => (approverId ? [approverId] : []))),
];

/** Audit payload extra: which line each approver approved, only when more than one approver is involved. */
export function overrideAudit(snapshot: SaleSnapshot) {
  if (overrideApprovers(snapshot).length < 2) return {};
  return {
    overrides: overrideList(snapshot).map(({ lineId, approverId }) => ({ lineId, approverId })),
  };
}
