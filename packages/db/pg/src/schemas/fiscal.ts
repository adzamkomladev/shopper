import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenant, branch, store } from "./base";
import { sale } from "./sales";
import { refund } from "./refunds";

export const fiscalStatuses = ["pending", "submitted", "accepted", "rejected", "dead"] as const;

/** One VAT invoice or credit note on its way to the GRA SDC; never blocks the sale that made it. */
export const fiscalDoc = pgTable(
  "fiscal_doc",
  {
    ...tenant(),
    storeId: uuid("store_id").notNull(),
    branchId: uuid("branch_id").notNull(),
    kind: text("kind", { enum: ["invoice", "credit_note"] }).notNull(),
    saleId: uuid("sale_id"),
    refundId: uuid("refund_id"),
    invoiceNumber: text("invoice_number").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status", { enum: fiscalStatuses }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    sdcId: text("sdc_id"),
    sdcCounter: bigint("sdc_counter", { mode: "number" }),
    signature: text("signature"),
    qr: text("qr"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    rejectionCode: text("rejection_code"),
    rejectionMessage: text("rejection_message"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    archiveId: uuid("archive_id"),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.orgId, t.saleId),
    unique().on(t.orgId, t.refundId),
    index("fiscal_doc_store_status").on(t.orgId, t.storeId, t.status),
    index("fiscal_doc_unarchived")
      .on(t.orgId, t.storeId, t.acceptedAt)
      .where(sql`archive_id IS NULL`),
    foreignKey({ columns: [t.orgId, t.storeId], foreignColumns: [store.orgId, store.id] }),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    foreignKey({ columns: [t.orgId, t.saleId], foreignColumns: [sale.orgId, sale.id] }),
    foreignKey({ columns: [t.orgId, t.refundId], foreignColumns: [refund.orgId, refund.id] }),
    foreignKey({
      columns: [t.orgId, t.archiveId],
      foreignColumns: [fiscalArchive.orgId, fiscalArchive.id],
    }),
    check(
      "fiscal_doc_status",
      sql`${t.status} IN ('pending', 'submitted', 'accepted', 'rejected', 'dead')`,
    ),
    check("fiscal_doc_kind_value", sql`${t.kind} IN ('invoice', 'credit_note')`),
    check("fiscal_doc_source", sql`(${t.saleId} IS NULL) <> (${t.refundId} IS NULL)`),
    check("fiscal_doc_kind", sql`(${t.kind} = 'invoice') = (${t.saleId} IS NOT NULL)`),
    check(
      "fiscal_doc_accepted",
      sql`${t.status} <> 'accepted' OR (${t.signature} IS NOT NULL AND ${t.acceptedAt} IS NOT NULL)`,
    ),
  ],
);

/** One hour of a store's accepted documents, stored as JSONL for the six-year archive. */
export const fiscalArchive = pgTable(
  "fiscal_archive",
  {
    ...tenant(),
    storeId: uuid("store_id").notNull(),
    hour: timestamp("hour", { withTimezone: true }).notNull(),
    key: text("key").notNull(),
    docCount: integer("doc_count").notNull(),
    sha256: text("sha256").notNull(),
    bytes: integer("bytes").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.orgId, t.storeId, t.hour),
    foreignKey({ columns: [t.orgId, t.storeId], foreignColumns: [store.orgId, store.id] }),
  ],
);
