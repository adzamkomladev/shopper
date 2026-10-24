import { sql } from "drizzle-orm";
import type { ShopperDatabase } from "@shopper/db-pg";

const DAY = 86_400_000;

/**
 * Where a (re)started schedule counts its runs from: the run day of the last period delivered, so a run day missed
 * while the box was down runs once on the next start (the delivery key keeps it idempotent). Never more than a month
 * back, so a schedule turned on again after a long pause does not send old periods; `now` when nothing was sent.
 */
export async function statementRunsSince(db: ShopperDatabase, orgId: string, now: number) {
  const { rows } = await db.execute<{ day: number; last: string | null }>(sql`
    SELECT o.statement_day AS day, (SELECT max(d.period_to)::text FROM statement_delivery d WHERE d.org_id = o.id) AS last
    FROM org o WHERE o.id = ${orgId}`);
  const row = rows[0];
  if (!row?.last) return now;
  const last = new Date(row.last);
  const ran = Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, row.day);
  return Math.min(now, Math.max(ran, now - 31 * DAY));
}

/** Orgs on a monthly schedule, with the member who last set it, so a box restart can start each schedule again. */
export async function scheduledOrgs(db: ShopperDatabase) {
  const { rows } = await db.execute<{ org_id: string; actor_id: string | null }>(sql`
    SELECT o.id AS org_id, (SELECT a.actor_id FROM audit_log a WHERE a.org_id = o.id
      AND a.command = 'statement.settings.set' ORDER BY a.created_at DESC, a.id DESC LIMIT 1) AS actor_id
    FROM org o WHERE o.statement_schedule = 'monthly'`);
  return rows.flatMap((row) =>
    row.actor_id ? [{ orgId: row.org_id, actorId: row.actor_id }] : [],
  );
}
