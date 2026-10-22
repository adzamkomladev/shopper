import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** What the till knows of each customer: the server's row with any edit still waiting to upload laid on top. */
export const customerLookup = sqliteTable(
  "customer_lookup",
  {
    orgId: text("org_id").notNull(),
    customerId: text("customer_id").notNull(),
    name: text("name").notNull(),
    /** 0XXXXXXXXX. Not unique: a lookup lists every match. */
    phone: text("phone").notNull(),
    kind: text("kind", { enum: ["individual", "business"] }).notNull(),
    businessName: text("business_name"),
    tin: text("tin"),
    /** The server version this row was last read at; an edit made here does not change it. */
    version: integer("version").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.orgId, t.customerId] }),
    index("customer_lookup_phone").on(t.orgId, t.phone),
  ],
);

/** Customers created and edited on the till, queued as `customer.created` / `customer.updated` events. */
export const customerUpload = sqliteTable(
  "customer_upload",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    deviceId: text("device_id").notNull(),
    customerId: text("customer_id").notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    sessionId: text("session_id").notNull(),
    createdAt: text("created_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: integer("next_attempt_at"),
    blockedCode: text("blocked_code"),
    blockedReason: text("blocked_reason"),
    acceptedAt: text("accepted_at"),
    result: text("result", { mode: "json" }).$type<Record<string, unknown>>(),
  },
  (t) => [index("customer_upload_customer").on(t.orgId, t.customerId)],
);
