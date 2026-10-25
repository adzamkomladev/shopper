import { blob, foreignKey, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { localSale } from "./sales";

/** Printing and digital-receipt delivery state, one row per local sale. */
export const receiptOutput = sqliteTable(
  "receipt_output",
  {
    saleId: text("sale_id").primaryKey(),
    orgId: text("org_id").notNull(),
    printedAt: text("printed_at"),
    printError: text("print_error"),
    reprints: integer("reprints").notNull().default(0),
    pdf: blob("pdf", { mode: "buffer" }),
    pdfSha256: text("pdf_sha256"),
    pdfSize: integer("pdf_size"),
    assetId: text("asset_id"),
    uploadedAt: text("uploaded_at"),
    uploadAttempts: integer("upload_attempts").notNull().default(0),
    nextUploadAt: integer("next_upload_at"),
    /** Set when the SDC signed the sale after this PDF was rendered: the definitive copy is still to render. */
    pdfStale: integer("pdf_stale", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    foreignKey({ columns: [t.orgId, t.saleId], foreignColumns: [localSale.orgId, localSale.id] }),
  ],
);
