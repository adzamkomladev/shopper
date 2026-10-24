import { affectedStores, customerUpsert, recordChanges } from "../changes";
import type { customer, ShopperTransaction } from "@shopper/db-pg";

/** Puts a changed customer on every store's feed; call it last in a command. */
export async function publishCustomer(
  tx: ShopperTransaction,
  orgId: string,
  row: typeof customer.$inferSelect,
) {
  await recordChanges(tx, orgId, [customerUpsert(row)], await affectedStores(tx, orgId));
}
