import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
export const paymentIntent = sqliteTable(
  "payment_intent",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    deviceId: text("device_id").notNull(),
    branchId: text("branch_id").notNull(),
    cashierId: text("cashier_id").notNull(),
    reference: text("reference").notNull(),
    amount: integer("amount").notNull(),
    phone: text("phone").notNull(),
    phoneFingerprint: text("phone_fingerprint"),
    network: text("network", { enum: ["mtn", "telecel", "airteltigo"] }).notNull(),
    status: text("status", {
      enum: ["pending", "otp", "confirmed", "failed", "expired"],
    }).notNull(),
    failureReason: text("failure_reason"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [unique().on(t.orgId, t.reference)],
);
