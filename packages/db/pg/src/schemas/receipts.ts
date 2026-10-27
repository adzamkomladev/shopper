import { foreignKey, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { tenant } from "./base";
import { sale } from "./sales";

/** A digital receipt email asked for once; `request_key` makes a redelivered or double-clicked send a no-op. */
export const receiptEmail = pgTable(
  "receipt_email",
  {
    ...tenant(),
    saleId: uuid("sale_id").notNull(),
    email: text("email").notNull(),
    requestKey: text("request_key").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    unique().on(t.orgId, t.requestKey),
    foreignKey({ columns: [t.orgId, t.saleId], foreignColumns: [sale.orgId, sale.id] }),
  ],
);
