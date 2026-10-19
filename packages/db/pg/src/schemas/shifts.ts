import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenant, branch, store, moneyColumn } from "./base";
import { user } from "./auth";
import { device, cashierSession } from "./devices";
import { tenderKinds } from "./sales";

/** A register's closed shift as its till uploaded it: the Z report, the anchor it closed on and who approved it. */
export const shift = pgTable(
  "shift",
  {
    ...tenant(),
    deviceId: uuid("device_id").notNull(),
    storeId: uuid("store_id").notNull(),
    branchId: uuid("branch_id").notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
    openedBy: uuid("opened_by").notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }).notNull(),
    closedBy: uuid("closed_by").notNull(),
    sessionId: uuid("session_id").notNull(),
    approverId: uuid("approver_id"),
    float: moneyColumn("float").notNull(),
    varianceThreshold: moneyColumn("variance_threshold").notNull(),
    expectedCash: moneyColumn("expected_cash").notNull(),
    declaredCash: moneyColumn("declared_cash").notNull(),
    report: jsonb("report").notNull(),
    anchorSeq: bigint("anchor_seq", { mode: "number" }).notNull(),
    anchorHash: text("anchor_hash").notNull(),
    eventVersion: bigint("event_version", { mode: "number" }).notNull().default(1),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
    contentHash: text("content_hash").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    index("shift_closed").on(t.orgId, t.closedAt),
    foreignKey({ columns: [t.orgId, t.deviceId], foreignColumns: [device.orgId, device.id] }),
    foreignKey({ columns: [t.orgId, t.storeId], foreignColumns: [store.orgId, store.id] }),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    foreignKey({ columns: [t.orgId, t.closedBy], foreignColumns: [user.orgId, user.id] }),
    foreignKey({ columns: [t.orgId, t.approverId], foreignColumns: [user.orgId, user.id] }),
    foreignKey({
      columns: [t.orgId, t.sessionId],
      foreignColumns: [cashierSession.orgId, cashierSession.id],
    }),
    check(
      "shift_amounts",
      sql`${t.float} >= 0 AND ${t.varianceThreshold} >= 0 AND ${t.declaredCash} >= 0`,
    ),
    check("shift_anchor", sql`${t.anchorSeq} >= 0 AND ${t.anchorHash} ~ '^[0-9a-f]{64}$'`),
    check("shift_event_version_positive", sql`${t.eventVersion} > 0`),
  ],
);

/** Expected, declared and variance per tender; the variance is always declared − expected. */
export const shiftTender = pgTable(
  "shift_tender",
  {
    ...tenant(),
    shiftId: uuid("shift_id").notNull(),
    tender: text("tender", { enum: tenderKinds }).notNull(),
    sales: moneyColumn("sales").notNull(),
    refunds: moneyColumn("refunds").notNull(),
    expected: moneyColumn("expected").notNull(),
    declared: moneyColumn("declared").notNull(),
    variance: moneyColumn("variance").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.shiftId, t.tender),
    foreignKey({ columns: [t.orgId, t.shiftId], foreignColumns: [shift.orgId, shift.id] }),
    check("shift_tender_kind", sql`${t.tender} IN ('cash', 'momo', 'card')`),
    check("shift_tender_variance", sql`${t.variance} = ${t.declared} - ${t.expected}`),
  ],
);

/** Cash drops and audited no-sales of a shift. */
export const shiftMovement = pgTable(
  "shift_movement",
  {
    ...tenant(),
    shiftId: uuid("shift_id").notNull(),
    kind: text("kind", { enum: ["drop", "no_sale"] }).notNull(),
    amount: moneyColumn("amount").notNull(),
    reason: text("reason"),
    actorId: uuid("actor_id").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("shift_movement_shift").on(t.orgId, t.shiftId),
    foreignKey({ columns: [t.orgId, t.shiftId], foreignColumns: [shift.orgId, shift.id] }),
    check(
      "shift_movement_kind",
      sql`(${t.kind} = 'drop' AND ${t.amount} > 0) OR (${t.kind} = 'no_sale' AND ${t.amount} = 0 AND ${t.reason} IS NOT NULL)`,
    ),
  ],
);
