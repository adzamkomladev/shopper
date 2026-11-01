import { and, eq, sql } from "drizzle-orm";
import { shopLogin, type ShopperDatabase } from "@shopper/db-pg";
import { ShopError } from "./error";
import type { ShopSession } from "./types";

/** How many codes a login has sent, so a resend knows which code comes next. */
export async function readLoginSends(db: ShopperDatabase, orgId: string, id: string) {
  const [row] = await db
    .select({ sends: shopLogin.sends })
    .from(shopLogin)
    .where(and(eq(shopLogin.orgId, orgId), eq(shopLogin.id, id)));
  if (!row) throw new ShopError("This sign-in has ended. Ask for a new code.", 404);
  return row.sends;
}

/**
 * The ids of the customer rows a shopper's purchases and points hang on: live rows with their phone at this shop,
 * and every row staff merged into one of them, however deep.
 */
export const customersOf = (session: Pick<ShopSession, "orgId" | "phone">) => sql`
  WITH RECURSIVE mine(id) AS (
    SELECT id FROM customer
    WHERE org_id = ${session.orgId} AND phone = ${session.phone} AND merged_into_id IS NULL
    UNION
    SELECT c.id FROM customer c JOIN mine ON c.merged_into_id = mine.id WHERE c.org_id = ${session.orgId}
  ) SELECT id FROM mine`;
