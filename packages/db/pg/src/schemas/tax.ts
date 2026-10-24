import { check, pgTable, text, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { moneyColumn, tenant } from "./base";

/** What the accountant claims as input tax for one VAT period (YYYY-MM); output tax is always folded from sales. */
export const vatReturn = pgTable(
  "vat_return",
  {
    ...tenant(),
    period: text("period").notNull(),
    inputVat: moneyColumn("input_vat")
      .notNull()
      .default(sql`0`),
    inputNhil: moneyColumn("input_nhil")
      .notNull()
      .default(sql`0`),
    inputGetfund: moneyColumn("input_getfund")
      .notNull()
      .default(sql`0`),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.orgId, t.period),
    check("vat_return_period", sql`${t.period} ~ '^\\d{4}-(0[1-9]|1[0-2])$'`),
    check(
      "vat_return_input",
      sql`${t.inputVat} >= 0 AND ${t.inputNhil} >= 0 AND ${t.inputGetfund} >= 0`,
    ),
  ],
);
