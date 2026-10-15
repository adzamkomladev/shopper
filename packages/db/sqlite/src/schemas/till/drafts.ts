import { foreignKey, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

/** Embedded-label provenance; a price label also keeps its encoded gross and the quantity it was encoded at. */
export type DraftLabel =
  | { kind: "weight"; code: string }
  | { kind: "price"; code: string; gross: number; originalQuantityThousandths: number };

export const saleDraft = sqliteTable(
  "sale_draft",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    deviceId: text("device_id").notNull(),
    branchId: text("branch_id").notNull(),
    cashierId: text("cashier_id").notNull(),
    revision: integer("revision").notNull(),
    totals: text("totals", { mode: "json" }).$type<Record<string, number>>().notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [unique().on(t.orgId, t.deviceId, t.branchId, t.cashierId), unique().on(t.orgId, t.id)],
);

export const saleDraftLine = sqliteTable(
  "sale_draft_line",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    draftId: text("draft_id").notNull(),
    position: integer("position").notNull(),
    productId: text("product_id").notNull(),
    quantityThousandths: integer("quantity_thousandths").notNull(),
    label: text("label", { mode: "json" }).$type<DraftLabel | null>(),
  },
  (t) => [
    unique().on(t.draftId, t.position),
    foreignKey({ columns: [t.orgId, t.draftId], foreignColumns: [saleDraft.orgId, saleDraft.id] }),
  ],
);
