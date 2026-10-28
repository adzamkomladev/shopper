import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenant } from "./base";
import { user } from "./auth";

export const asset = pgTable(
  "asset",
  {
    ...tenant(),
    purpose: text("purpose", {
      enum: ["catalogue_import", "sync_snapshot", "sale_receipt", "kyb_document"],
    }).notNull(),
    visibility: text("visibility", { enum: ["private"] }).notNull(),
    bucket: text("bucket", { enum: ["imports", "snapshots", "receipts"] }).notNull(),
    key: text("key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    /** The digest of the bytes last verified in storage; a sale receipt is served once it equals `sha256`. */
    verifiedSha256: text("verified_sha256"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    actorId: uuid("actor_id"),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.orgId, t.key),
    foreignKey({ columns: [t.orgId, t.actorId], foreignColumns: [user.orgId, user.id] }),
    check(
      "asset_policy",
      sql`(${t.purpose} = 'catalogue_import' AND ${t.bucket} = 'imports' AND ${t.expiresAt} IS NOT NULL) OR (${t.purpose} = 'sync_snapshot' AND ${t.bucket} = 'snapshots' AND ${t.expiresAt} IS NULL) OR (${t.purpose} = 'sale_receipt' AND ${t.bucket} = 'receipts' AND ${t.expiresAt} IS NULL) OR (${t.purpose} = 'kyb_document' AND ${t.bucket} = 'receipts' AND ${t.expiresAt} IS NULL)`,
    ),
    check("asset_private", sql`${t.visibility} = 'private'`),
    check("asset_size", sql`${t.sizeBytes} >= 0`),
    check("asset_sha256", sql`${t.sha256} ~ '^[a-f0-9]{64}$'`),
  ],
);
