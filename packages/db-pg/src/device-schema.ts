import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  unique,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { org, branch, device, user, role } from "./base-schema";
const tenant = () => ({
  id: uuid("id")
    .primaryKey()
    .default(sql`uuidv7()`),
  orgId: uuid("org_id")
    .notNull()
    .references(() => org.id),
});
const expiry = () => timestamp("expires_at", { withTimezone: true }).notNull();
export const deviceEnrollment = pgTable(
  "device_enrollment",
  {
    ...tenant(),
    branchId: uuid("branch_id").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: expiry(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (t) => [
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
  ],
);
export const deviceCredential = pgTable(
  "device_credential",
  {
    ...tenant(),
    deviceId: uuid("device_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    unique().on(t.tokenHash),
    unique().on(t.orgId, t.deviceId),
    foreignKey({ columns: [t.orgId, t.deviceId], foreignColumns: [device.orgId, device.id] }),
  ],
);
export const cashierPin = pgTable(
  "cashier_pin",
  {
    ...tenant(),
    userId: uuid("user_id").notNull(),
    pinHash: text("pin_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
  },
  (t) => [
    unique().on(t.orgId, t.userId),
    check("cashier_pin_attempts_check", sql`${t.attempts} >= 0`),
    foreignKey({ columns: [t.orgId, t.userId], foreignColumns: [user.orgId, user.id] }),
  ],
);
export const cashierSession = pgTable(
  "cashier_session",
  {
    ...tenant(),
    deviceId: uuid("device_id").notNull(),
    branchId: uuid("branch_id").notNull(),
    userId: uuid("user_id").notNull(),
    roleId: uuid("role_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: expiry(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    unique().on(t.tokenHash),
    foreignKey({ columns: [t.orgId, t.deviceId], foreignColumns: [device.orgId, device.id] }),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    foreignKey({ columns: [t.orgId, t.userId], foreignColumns: [user.orgId, user.id] }),
    foreignKey({ columns: [t.orgId, t.roleId], foreignColumns: [role.orgId, role.id] }),
  ],
);

export const enrollmentAttempt = pgTable(
  "enrollment_attempt",
  {
    ...tenant(),
    attempts: integer("attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }).notNull(),
  },
  (t) => [
    unique().on(t.orgId),
    check("enrollment_attempt_attempts_check", sql`${t.attempts} >= 0`),
  ],
);
