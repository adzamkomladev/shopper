import { and, eq, inArray, isNull } from "drizzle-orm";
import type { CommandContext } from "@shopper/audit";
import {
  cashierSession,
  device,
  deviceCredential,
  member,
  permission,
  product,
  rolePermission,
  type ShopperTransaction,
} from "@shopper/db-pg";
import type { UploadPrincipal } from "../sales/types";
import type { StockDocument } from "../schemas/stock/document";
import { StockError } from "./error";

/** The enrolled device, the cashier session proof and the live till-allowed `stock.write` grant. */
export async function validateStockAuthority(
  tx: ShopperTransaction,
  ctx: CommandContext,
  principal: UploadPrincipal,
  document: StockDocument,
  proofHash: string,
  occurredAt: Date,
) {
  const [registered] = await tx
    .select({ id: device.id })
    .from(deviceCredential)
    .innerJoin(
      device,
      and(eq(device.orgId, deviceCredential.orgId), eq(device.id, deviceCredential.deviceId)),
    )
    .where(
      and(
        eq(deviceCredential.orgId, ctx.orgId),
        eq(deviceCredential.deviceId, principal.deviceId),
        eq(device.branchId, principal.branchId),
        isNull(deviceCredential.revokedAt),
      ),
    );
  const [session] = await tx
    .select()
    .from(cashierSession)
    .where(
      and(
        eq(cashierSession.orgId, ctx.orgId),
        eq(cashierSession.id, document.sessionId),
        eq(cashierSession.deviceId, principal.deviceId),
        eq(cashierSession.branchId, principal.branchId),
        eq(cashierSession.userId, document.actorId),
        eq(cashierSession.tokenHash, proofHash),
        isNull(cashierSession.revokedAt),
      ),
    );
  if (!registered || !session || occurredAt < session.issuedAt || occurredAt >= session.expiresAt)
    throw new StockError("INVALID_SESSION", "Stock document lacks valid cashier authority");
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
    .where(
      and(
        eq(member.orgId, ctx.orgId),
        eq(member.userId, document.actorId),
        eq(permission.code, "stock.write"),
        eq(permission.tillAllowed, true),
      ),
    );
  if (!granted || !session.permissions.includes("stock.write"))
    throw new StockError("FORBIDDEN", "Actor may not change stock on a till");
  ctx.role = session.roleName;
}

export async function validateProducts(tx: ShopperTransaction, orgId: string, ids: string[]) {
  const found = await tx
    .select({ id: product.id })
    .from(product)
    .where(and(eq(product.orgId, orgId), inArray(product.id, ids)));
  if (found.length !== ids.length)
    throw new StockError("INVALID_REFERENCE", "Stock document names an unknown product");
}
