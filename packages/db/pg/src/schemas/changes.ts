import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { org, store } from "./base";

export const storeChangeEntities = [
  "product",
  "price",
  "tax-rule",
  "barcode-mapping",
  "customer",
] as const;

/** The per-store change feed tills pull from. Append-only: rows are never updated or deleted. */
export const storeChange = pgTable(
  "store_change",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => org.id),
    storeId: uuid("store_id").notNull(),
    seq: bigint("seq", { mode: "bigint" }).notNull(),
    id: uuid("id")
      .notNull()
      .default(sql`uuidv7()`),
    entity: text("entity", { enum: storeChangeEntities }).notNull(),
    entityId: uuid("entity_id").notNull(),
    op: text("op", { enum: ["upsert", "delete"] }).notNull(),
    v: integer("v").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.orgId, t.storeId, t.seq] }),
    check(
      "store_change_entity",
      sql`${t.entity} IN ('product', 'price', 'tax-rule', 'barcode-mapping', 'customer')`,
    ),
    check("store_change_op", sql`${t.op} IN ('upsert', 'delete')`),
    foreignKey({ columns: [t.orgId, t.storeId], foreignColumns: [store.orgId, store.id] }),
  ],
);
