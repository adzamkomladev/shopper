// Dated seeding and direct reads for the time-based account postings (interest, points expiry, tier notices).
//   setOrg(columns)                     -> UPDATE org SET <snake_case column> = value, ... for the fixture org
//   pointsAt(customer, reason, points, at) -> a loyalty_entry dated `at` (ISO); answers its id
//   saleAt(customer, total, at)         -> a completed sale row dated `at`, copied from any recorded sale
//   notices(customer)                   -> the customer's tier_notice rows
//   queue()                             -> a Queue that keeps what it is sent in `sent`
//   context                             -> the command context the postings run with
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import type { Envelope, Queue } from "@shopper/ports";
import { ids } from "../till/sales";
import { databases } from "../till/server";

export const context = { orgId: ids.org, appVersion: "test" };

export async function setOrg(columns: Record<string, number | boolean>) {
  const sets = Object.entries(columns).map(
    ([column, value]) => sql`${sql.identifier(column)} = ${value}`,
  );
  await databases().db.execute(
    sql`UPDATE org SET ${sql.join(sets, sql`, `)} WHERE id = ${ids.org}`,
  );
}

export async function pointsAt(
  customerId: string,
  reason: "earn" | "redeem" | "reverse" | "transfer",
  points: number,
  at: string,
) {
  const id = v7();
  await databases().db.execute(sql`
    INSERT INTO loyalty_entry (id, org_id, customer_id, reason, points, rate_bps, point_value, actor_id, occurred_at)
    VALUES (${id}, ${ids.org}, ${customerId}, ${reason}, ${points},
      ${reason === "earn" ? 100 : null}, ${reason === "earn" ? 100 : null}, ${ids.cashier}, ${at}::timestamptz)`);
  return id;
}

/** Needs one recorded sale in the database to copy the device, store and session from. */
export async function saleAt(customerId: string, total: number, at: string) {
  const id = v7();
  const { rowCount } = await databases().db.execute(sql`
    INSERT INTO sale (id, org_id, device_id, local_id, store_id, branch_id, cashier_id, session_id, app_version,
      device_time, occurred_at, accepted_at, payload, content_hash, total, paid, customer_id)
    SELECT ${id}, org_id, device_id, ${v7()}, store_id, branch_id, cashier_id, session_id, app_version,
      ${at}::timestamptz, ${at}::timestamptz, ${at}::timestamptz, payload, content_hash, ${total}, ${total}, ${customerId}
    FROM sale WHERE org_id = ${ids.org} LIMIT 1`);
  if (rowCount !== 1) throw new Error("saleAt needs one recorded sale to copy");
  return id;
}

export async function notices(customerId: string) {
  const { rows } = await databases().db.execute<Record<string, any>>(sql`
    SELECT n.effective_on::text AS effective_on, f.name AS from_tier, t.name AS to_tier, n.sent_at, n.channel
    FROM tier_notice n JOIN loyalty_tier f ON f.id = n.from_tier_id LEFT JOIN loyalty_tier t ON t.id = n.to_tier_id
    WHERE n.customer_id = ${customerId} ORDER BY n.effective_on`);
  return rows;
}

export function queue(): Queue & { sent: Envelope[] } {
  const sent: Envelope[] = [];
  return {
    sent,
    policy: { maxAttempts: 1, delayMs: 0, backoff: "constant" },
    send: async (message) => void sent.push(message),
  };
}
