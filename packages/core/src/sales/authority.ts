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
  /** What a valid session that lacks `required` is refused with; most lanes do not tell the two apart. */
  deniedCode = "INVALID_SESSION",
) {
  // One round trip: the session row only comes back while the device credential and membership also hold.
  const [granted] = await tx
    .select({ session: cashierSession })
    .from(cashierSession)
    .innerJoin(
      deviceCredential,
      and(
        eq(deviceCredential.orgId, cashierSession.orgId),
        eq(deviceCredential.deviceId, cashierSession.deviceId),
        isNull(deviceCredential.revokedAt),
      ),
    )
    .innerJoin(
      device,
      and(eq(device.orgId, deviceCredential.orgId), eq(device.id, deviceCredential.deviceId)),
    )
    .innerJoin(branch, and(eq(branch.orgId, device.orgId), eq(branch.id, device.branchId)))
    .innerJoin(
      member,
      and(eq(member.orgId, cashierSession.orgId), eq(member.userId, cashierSession.userId)),
    )
    .where(
      and(
        eq(cashierSession.orgId, ctx.orgId),
        eq(cashierSession.id, snapshot.sessionId),
        eq(cashierSession.deviceId, principal.deviceId),
        eq(cashierSession.branchId, principal.branchId),
        eq(cashierSession.userId, snapshot.cashierId),
        eq(cashierSession.tokenHash, proofHash),
        isNull(cashierSession.revokedAt),
        eq(device.branchId, principal.branchId),
        eq(branch.storeId, principal.storeId),
      ),
    )
    .limit(1);
  const session = granted?.session;
  const refused = "Sale lacks valid historical cashier authority";
  if (!session || time < session.issuedAt || time >= session.expiresAt)
    throw new SaleError("INVALID_SESSION", refused);
  if (!session.permissions.includes(required)) throw new SaleError(deniedCode, refused);
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
 * `sale.price_override`. Sets the audit approver when every override names the same one and none is self-authorised.
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
  if (only && !others.length && overrideList(snapshot).every(({ approverId }) => approverId))
    ctx.approverId = only;
}

const overrideList = (snapshot: SaleSnapshot) =>
  snapshot.lines.flatMap((line) => (line.override ? [{ lineId: line.id, ...line.override }] : []));
const overrideApprovers = (snapshot: SaleSnapshot) => [
  ...new Set(overrideList(snapshot).flatMap(({ approverId }) => (approverId ? [approverId] : []))),
];

/** Audit payload extra: which approver (or null, the cashier) authorised each overridden line. */
export function overrideAudit(snapshot: SaleSnapshot) {
  const overrides = overrideList(snapshot);
  if (!overrides.length) return {};
  return { overrides: overrides.map(({ lineId, approverId }) => ({ lineId, approverId })) };
}
