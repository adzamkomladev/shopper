import { sql } from "drizzle-orm";
import { check, foreignKey, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { tenant, branch, moneyColumn } from "./base";
import { user } from "./auth";
import { device } from "./devices";

export const paymentNetworks = ["mtn", "telecel", "airteltigo"] as const;
export const paymentStatuses = ["pending", "otp", "confirmed", "failed", "expired"] as const;

/** A MoMo charge intent. `reference` is also the id of the workflow instance that drives it. */
export const payment = pgTable(
  "payment",
  {
    ...tenant(),
    branchId: uuid("branch_id").notNull(),
    deviceId: uuid("device_id").notNull(),
    cashierId: uuid("cashier_id").notNull(),
    reference: text("reference").notNull(),
    amount: moneyColumn("amount").notNull(),
    phone: text("phone").notNull(),
    network: text("network", { enum: paymentNetworks }).notNull(),
    status: text("status", { enum: paymentStatuses }).notNull().default("pending"),
    providerReference: text("provider_reference"),
    failureReason: text("failure_reason"),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.orgId, t.reference),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    foreignKey({ columns: [t.orgId, t.deviceId], foreignColumns: [device.orgId, device.id] }),
    foreignKey({ columns: [t.orgId, t.cashierId], foreignColumns: [user.orgId, user.id] }),
    // MoMo amounts are whole pesewas: 100 money units each.
    check("payment_amount", sql`${t.amount} > 0 AND ${t.amount} % 100 = 0`),
    check("payment_network", sql`${t.network} IN ('mtn', 'telecel', 'airteltigo')`),
    check(
      "payment_status",
      sql`${t.status} IN ('pending', 'otp', 'confirmed', 'failed', 'expired')`,
    ),
  ],
);
