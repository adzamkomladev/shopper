import { sql } from "drizzle-orm";
import { check, date, foreignKey, index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { tenant, moneyColumn, momoProviders } from "../base";
import { payment } from "./base";

/** One provider payout as it concerns one org: only the lines that match that org's payments. */
export const settlement = pgTable(
  "settlement",
  {
    ...tenant(),
    provider: text("provider", { enum: momoProviders }).notNull(),
    providerId: text("provider_id").notNull(),
    settledOn: date("settled_on").notNull(),
    amount: moneyColumn("amount").notNull(),
    fees: moneyColumn("fees").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.orgId, t.provider, t.providerId),
    check("settlement_provider", sql`${t.provider} IN ('paystack', 'hubtel')`),
  ],
);

export const settlementFlags = ["ok", "amount_mismatch"] as const;

/** A settled transaction matched to its payment; `amount_mismatch` when it differs from what was confirmed. */
export const settlementLine = pgTable(
  "settlement_line",
  {
    ...tenant(),
    settlementId: uuid("settlement_id").notNull(),
    paymentId: uuid("payment_id").notNull(),
    amount: moneyColumn("amount").notNull(),
    fee: moneyColumn("fee").notNull(),
    flag: text("flag", { enum: settlementFlags }).notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.settlementId, t.paymentId),
    index("settlement_line_payment").on(t.orgId, t.paymentId),
    foreignKey({
      columns: [t.orgId, t.settlementId],
      foreignColumns: [settlement.orgId, settlement.id],
    }),
    foreignKey({ columns: [t.orgId, t.paymentId], foreignColumns: [payment.orgId, payment.id] }),
    check("settlement_line_flag", sql`${t.flag} IN ('ok', 'amount_mismatch')`),
  ],
);
