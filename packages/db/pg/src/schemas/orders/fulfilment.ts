import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  integer,
  pgTable,
  time,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { branch, moneyColumn, tenant } from "../base";

/**
 * How one branch hands over online orders: pickup and/or delivery at one flat fee, in slots of `slot_minutes`
 * between `opens` and `closes` (Accra time), at most `slot_capacity` orders a slot, no sooner than `lead_minutes` away.
 * A branch without a row takes no online orders.
 */
export const branchFulfilment = pgTable(
  "branch_fulfilment",
  {
    ...tenant(),
    branchId: uuid("branch_id").notNull(),
    pickup: boolean("pickup").notNull().default(true),
    delivery: boolean("delivery").notNull().default(false),
    deliveryFee: moneyColumn("delivery_fee")
      .notNull()
      .default(sql`0`),
    opens: time("opens").notNull().default("08:00"),
    closes: time("closes").notNull().default("20:00"),
    slotMinutes: integer("slot_minutes").notNull().default(60),
    slotCapacity: integer("slot_capacity").notNull().default(10),
    leadMinutes: integer("lead_minutes").notNull().default(60),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique("branch_fulfilment_branch").on(t.orgId, t.branchId),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    check("branch_fulfilment_hours", sql`${t.closes} > ${t.opens}`),
    check("branch_fulfilment_slot", sql`${t.slotMinutes} IN (30, 60, 120)`),
    check("branch_fulfilment_capacity", sql`${t.slotCapacity} BETWEEN 1 AND 500`),
    check("branch_fulfilment_lead", sql`${t.leadMinutes} BETWEEN 0 AND 2880`),
    check("branch_fulfilment_fee", sql`${t.deliveryFee} >= 0`),
  ],
);
