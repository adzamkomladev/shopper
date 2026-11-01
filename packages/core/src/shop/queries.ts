import { and, eq } from "drizzle-orm";
import { shopLogin, type ShopperDatabase } from "@shopper/db-pg";
import { ShopError } from "./error";

/** How many codes a login has sent, so a resend knows which code comes next. */
export async function readLoginSends(db: ShopperDatabase, orgId: string, id: string) {
  const [row] = await db
    .select({ sends: shopLogin.sends })
    .from(shopLogin)
    .where(and(eq(shopLogin.orgId, orgId), eq(shopLogin.id, id)));
  if (!row) throw new ShopError("This sign-in has ended. Ask for a new code.", 404);
  return row.sends;
}
