import { and, eq } from "drizzle-orm";
import { org, shopAccount, type ShopperDatabase } from "@shopper/db-pg";
import type { ShopSession } from "./types";

/** The signed-in shopper as the account page heads it: who they are and which shop they are at. */
export async function readShopAccount(db: ShopperDatabase, session: ShopSession) {
  const [row] = await db
    .select({ account: shopAccount, shopName: org.name, shopCode: org.slug })
    .from(shopAccount)
    .innerJoin(org, eq(org.id, shopAccount.orgId))
    .where(and(eq(shopAccount.orgId, session.orgId), eq(shopAccount.id, session.accountId)));
  return {
    id: row!.account.id,
    phone: row!.account.phone,
    name: row!.account.name,
    email: row!.account.email,
    shop: { name: row!.shopName, code: row!.shopCode },
  };
}
