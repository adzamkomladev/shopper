import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenant, branch, moneyColumn } from "../base";
import { user } from "../auth";
import { device } from "../devices";
import { sale } from "../sales";
import { customer } from "./base";

export const holdKinds = ["credit", "loyalty"] as const;
export const holdStatuses = ["held", "consumed", "released"] as const;

/** Credit or points set aside online before a sale completes; its id is the till tender id. A held row counts for an hour. */
export const accountHold = pgTable(
  "account_hold",
  {
    ...tenant(),
    customerId: uuid("customer_id").notNull(),
    kind: text("kind", { enum: holdKinds }).notNull(),
    amount: moneyColumn("amount"),
    points: integer("points"),
    pointValue: moneyColumn("point_value"),
    branchId: uuid("branch_id").notNull(),
    deviceId: uuid("device_id").notNull(),
    cashierId: uuid("cashier_id").notNull(),
    status: text("status", { enum: holdStatuses }).notNull().default("held"),
    saleId: uuid("sale_id"),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    index("account_hold_customer").on(t.orgId, t.customerId, t.status),
    foreignKey({
      columns: [t.orgId, t.customerId],
      foreignColumns: [customer.orgId, customer.id],
    }),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    foreignKey({ columns: [t.orgId, t.deviceId], foreignColumns: [device.orgId, device.id] }),
    foreignKey({ columns: [t.orgId, t.cashierId], foreignColumns: [user.orgId, user.id] }),
    foreignKey({ columns: [t.orgId, t.saleId], foreignColumns: [sale.orgId, sale.id] }),
    check("account_hold_kind", sql`${t.kind} IN ('credit', 'loyalty')`),
    check("account_hold_status", sql`${t.status} IN ('held', 'consumed', 'released')`),
    check(
      "account_hold_size",
      sql`(${t.kind} = 'credit' AND ${t.amount} > 0 AND ${t.points} IS NULL AND ${t.pointValue} IS NULL)
        OR (${t.kind} = 'loyalty' AND ${t.points} > 0 AND ${t.pointValue} > 0 AND ${t.amount} IS NULL)`,
    ),
  ],
);
