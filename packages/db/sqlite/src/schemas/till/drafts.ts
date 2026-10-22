import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/** Embedded-label provenance; a price label also keeps its encoded gross and the quantity it was encoded at. */
export type DraftLabel =
  | { kind: "weight"; code: string }
  | {
      kind: "price";
      code: string;
      gross: number;
      originalQuantityThousandths: number;
      originalPriceId: string;
    };

export const draftStatuses = ["open", "held", "voided"] as const;
export const draftTenderKinds = ["cash", "momo", "card"] as const;
export const draftTenderStatuses = [
  "applied",
  "pending",
  "otp",
  "confirmed",
  "failed",
  "expired",
] as const;

export const saleDraft = sqliteTable(
  "sale_draft",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    deviceId: text("device_id").notNull(),
    branchId: text("branch_id").notNull(),
    cashierId: text("cashier_id").notNull(),
    status: text("status", { enum: draftStatuses }).notNull().default("open"),
    name: text("name"),
    /** The customer attached to the basket, from `customer_lookup`. */
    customerId: text("customer_id"),
    revision: integer("revision").notNull(),
    totals: text("totals", { mode: "json" }).$type<Record<string, number>>().notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    heldAt: text("held_at"),
    voidedAt: text("voided_at"),
    voidReason: text("void_reason"),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    // One open basket per cashier on a till; held and voided drafts pile up beside it.
    uniqueIndex("sale_draft_open")
      .on(t.orgId, t.deviceId, t.branchId, t.cashierId)
      .where(sql`${t.status} = 'open'`),
    check("sale_draft_status", sql`${t.status} IN ('open', 'held', 'voided')`),
  ],
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
    /** Money off the line's gross, inclusive of tax. */
    discount: integer("discount").notNull().default(0),
    /** A manager-approved unit price replacing the list price; the approver is null when the cashier held the grant. */
    overridePrice: integer("override_price"),
    overrideApproverId: text("override_approver_id"),
    overrideReason: text("override_reason"),
  },
  (t) => [
    unique().on(t.draftId, t.position),
    foreignKey({ columns: [t.orgId, t.draftId], foreignColumns: [saleDraft.orgId, saleDraft.id] }),
  ],
);

export const saleDraftTender = sqliteTable(
  "sale_draft_tender",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    draftId: text("draft_id").notNull(),
    position: integer("position").notNull(),
    kind: text("kind", { enum: draftTenderKinds }).notNull(),
    amount: integer("amount").notNull(),
    /** The MoMo payment reference. */
    reference: text("reference"),
    approvalCode: text("approval_code"),
    last4: text("last4"),
    /** MoMo phone, stored masked. */
    phone: text("phone"),
    network: text("network"),
    status: text("status", { enum: draftTenderStatuses }).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    unique().on(t.draftId, t.position),
    foreignKey({ columns: [t.orgId, t.draftId], foreignColumns: [saleDraft.orgId, saleDraft.id] }),
  ],
);
