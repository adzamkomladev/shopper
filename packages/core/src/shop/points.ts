import { sql } from "drizzle-orm";
import type { ShopperDatabase } from "@shopper/db-pg";
import { readLoyaltySettings } from "../customers/loyalty/settings";
import { tierFor } from "../customers/loyalty/tiers";
import { customersOf } from "./queries";
import type { ShopSession } from "./types";

// ponytail: newest 50 entries; the balance is the whole ledger's fold either way.
const RECENT = 50;

/** The shopper's points at this shop, summed over their customer rows, the tier they hold and recent movements. */
export async function readShopPoints(db: ShopperDatabase, session: ShopSession, now = new Date()) {
  const settings = await readLoyaltySettings(db, session.orgId);
  const { rows } = await db.execute<{
    id: string;
    reason: string;
    points: string;
    sale_id: string | null;
    occurred_at: string;
    total: string;
  }>(sql`
    SELECT id, reason, points::text, sale_id,
      to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS occurred_at,
      (SUM(points) OVER ())::text AS total
    FROM loyalty_entry
    WHERE org_id = ${session.orgId} AND customer_id IN (${customersOf(session)})
    ORDER BY occurred_at DESC, id DESC`);
  // The oldest live row is the one tills keep earning on; rows merged into it count towards its tier.
  const { rows: live } = await db.execute<{ id: string }>(sql`
    SELECT id FROM customer
    WHERE org_id = ${session.orgId} AND phone = ${session.phone} AND merged_into_id IS NULL AND archived_at IS NULL
    ORDER BY id LIMIT 1`);
  const tier =
    settings.enabled && live[0] ? await tierFor(db, session.orgId, live[0].id, now) : null;
  return {
    enabled: settings.enabled,
    points: Number(rows[0]?.total ?? 0),
    tier: tier && { name: tier.name },
    entries: rows.slice(0, RECENT).map((row) => ({
      id: row.id,
      reason: row.reason,
      points: Number(row.points),
      saleId: row.sale_id,
      occurredAt: row.occurred_at,
    })),
  };
}
