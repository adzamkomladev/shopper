// A year of trading by SQL for the speed check: copies of the report world's accepted cash and card sales (lines and
// tenders too), spread over every day from `from` to `to` at both branches, by both cashiers, at shop hours.
import { sql } from "drizzle-orm";
import { ids } from "../../fixtures/sales/golden";
import { databases } from "../till/server";

export async function seedYear(options: {
  templates: string[];
  from: string;
  to: string;
  perDay: number;
  otherBranch: string;
  second: string;
}) {
  const { db } = databases();
  await db.transaction(async (tx) => {
    await tx.execute(sql`CREATE TEMP TABLE year_sale ON COMMIT DROP AS
      SELECT uuidv7() AS id, t.id AS template, n % 2 = 1 AS elsewhere,
        (d::date + make_interval(hours => 7 + n % 14, mins => n % 60))::timestamp AT TIME ZONE 'Africa/Accra' AS at
      FROM generate_series(${options.from}::date, ${options.to}::date, interval '1 day') d
      CROSS JOIN generate_series(0, ${options.perDay - 1}) n
      JOIN (SELECT id, row_number() OVER (ORDER BY id) - 1 AS k FROM sale
        WHERE id IN (${sql.join(
          options.templates.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})) t ON t.k = n % ${options.templates.length}`);
    await tx.execute(sql`INSERT INTO sale (id, org_id, device_id, local_id, store_id, branch_id, cashier_id,
        session_id, app_version, event_version, device_time, occurred_at, payload, content_hash, status, total,
        cash_rounding, paid, change)
      SELECT y.id, s.org_id, s.device_id, uuidv7(), s.store_id,
        CASE WHEN y.elsewhere THEN ${options.otherBranch}::uuid ELSE s.branch_id END,
        CASE WHEN y.elsewhere THEN ${options.second}::uuid ELSE s.cashier_id END,
        s.session_id, s.app_version, s.event_version, y.at, y.at, s.payload, s.content_hash, s.status, s.total,
        s.cash_rounding, s.paid, s.change
      FROM year_sale y JOIN sale s ON s.id = y.template`);
    await tx.execute(sql`INSERT INTO sale_line (org_id, sale_id, product_id, price_id, tax_rule_id, payload)
      SELECT l.org_id, y.id, l.product_id, l.price_id, l.tax_rule_id, l.payload
      FROM year_sale y JOIN sale_line l ON l.sale_id = y.template`);
    await tx.execute(sql`INSERT INTO sale_tender (org_id, sale_id, position, kind, amount, reference)
      SELECT t.org_id, y.id, t.position, t.kind, t.amount, t.reference
      FROM year_sale y JOIN sale_tender t ON t.sale_id = y.template`);
    // Every day is stale until the rollup runs, as acceptance leaves it.
    await tx.execute(sql`INSERT INTO store_day (org_id, store_id, day)
      SELECT ${ids.org}, ${ids.store}, d::date
      FROM generate_series(${options.from}::date, ${options.to}::date, interval '1 day') d
      ON CONFLICT (org_id, store_id, day) DO UPDATE SET rolled_at = NULL`);
  });
}
