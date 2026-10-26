import { and, eq, isNull } from "drizzle-orm";
import {
  invitation,
  org,
  role,
  user,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { assertLink, AuthLinkError } from "../links/tokens";
export async function invitationFor(
  db: ShopperDatabase | ShopperTransaction,
  id: string,
  token: string,
  now: number,
  orgId?: string,
) {
  const [row] = await db
    .select()
    .from(invitation)
    .where(and(eq(invitation.id, id), ...(orgId ? [eq(invitation.orgId, orgId)] : [])));
  if (!row || !row.tokenDigest || !row.roleId || row.status !== "pending" || row.consumedAt)
    throw new AuthLinkError("This link is invalid or expired", 410);
  await assertLink(row.tokenDigest, token, row.expiresAt, now);
  return row;
}
export async function invitationPreview(
  db: ShopperDatabase | ShopperTransaction,
  row: typeof invitation.$inferSelect,
) {
  const [shop] = await db
    .select({ name: org.name, slug: org.slug })
    .from(org)
    .where(eq(org.id, row.orgId));
  const [requestedRole] = await db
    .select({ name: role.name })
    .from(role)
    .where(and(eq(role.orgId, row.orgId), eq(role.id, row.roleId!), isNull(role.archivedAt)));
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.orgId, row.orgId), eq(user.email, row.email)));
  if (!shop || !requestedRole) throw new AuthLinkError("This link is invalid or expired", 410);
  return {
    id: row.id,
    orgId: row.orgId,
    shopCode: shop.slug,
    shopName: shop.name,
    email: row.email,
    roleId: row.roleId!,
    roleName: requestedRole.name,
    channel: row.channel,
    expiresAt: row.expiresAt.toISOString(),
    existingAccount: Boolean(existing),
  };
}
export function invitationView(row: typeof invitation.$inferSelect) {
  return {
    id: row.id,
    email: row.email,
    roleId: row.roleId,
    channel: row.channel,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    consumedAt: row.consumedAt?.toISOString() ?? null,
  };
}
