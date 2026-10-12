import { boolean, foreignKey, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { org, tenant } from "./base";

export const user = pgTable(
  "user",
  {
    ...tenant(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
  },
  (t) => [unique().on(t.orgId, t.id), unique().on(t.orgId, t.email)],
);
export const role = pgTable(
  "role",
  {
    ...tenant(),
    name: text("name").notNull(),
  },
  (t) => [unique().on(t.orgId, t.id), unique().on(t.orgId, t.name)],
);
export const permission = pgTable(
  "permission",
  {
    ...tenant(),
    code: text("code").notNull(),
    tillAllowed: boolean("till_allowed").notNull().default(false),
  },
  (t) => [unique().on(t.orgId, t.id), unique().on(t.orgId, t.code)],
);
export const rolePermission = pgTable(
  "role_permission",
  {
    ...tenant(),
    roleId: uuid("role_id").notNull(),
    permissionId: uuid("permission_id").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.roleId, t.permissionId),
    foreignKey({ columns: [t.orgId, t.roleId], foreignColumns: [role.orgId, role.id] }),
    foreignKey({
      columns: [t.orgId, t.permissionId],
      foreignColumns: [permission.orgId, permission.id],
    }),
  ],
);
/** Better Auth tables, tenant-scoped like everything else. */
export const session = pgTable(
  "session",
  {
    ...tenant(),
    userId: uuid("user_id").notNull(),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    activeOrganizationId: uuid("active_organization_id"),
  },
  (t) => [
    unique().on(t.token),
    foreignKey({ columns: [t.orgId, t.userId], foreignColumns: [user.orgId, user.id] }),
    foreignKey({
      columns: [t.orgId, t.activeOrganizationId],
      foreignColumns: [org.orgId, org.id],
    }),
  ],
);
export const account = pgTable(
  "account",
  {
    ...tenant(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
  },
  (t) => [foreignKey({ columns: [t.orgId, t.userId], foreignColumns: [user.orgId, user.id] })],
);
export const verification = pgTable("verification", {
  ...tenant(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const member = pgTable(
  "member",
  {
    ...tenant(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: text("role").notNull().default("member"),
    roleId: uuid("role_id").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.organizationId, t.userId),
    foreignKey({ columns: [t.orgId, t.organizationId], foreignColumns: [org.orgId, org.id] }),
    foreignKey({ columns: [t.orgId, t.userId], foreignColumns: [user.orgId, user.id] }),
    foreignKey({ columns: [t.orgId, t.roleId], foreignColumns: [role.orgId, role.id] }),
  ],
);
export const invitation = pgTable(
  "invitation",
  {
    ...tenant(),
    organizationId: uuid("organization_id").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull().default("member"),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    inviterId: uuid("inviter_id").notNull(),
  },
  (t) => [
    foreignKey({ columns: [t.orgId, t.organizationId], foreignColumns: [org.orgId, org.id] }),
    foreignKey({ columns: [t.orgId, t.inviterId], foreignColumns: [user.orgId, user.id] }),
  ],
);
