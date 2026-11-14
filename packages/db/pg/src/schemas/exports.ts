import {
  bigint,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { tenant } from "./base";

export const exportStatuses = ["running", "ready", "failed", "deleted"] as const;

/**
 * One Shopper Archive an owner asked for. The parts live in the org's blobs under `exports/<id>/`; the row says
 * whether they are complete, how big the file they assemble into is, and who asked. Never exported itself.
 */
export const exportJob = pgTable(
  "export_job",
  {
    ...tenant(),
    status: text("status", { enum: exportStatuses }).notNull().default("running"),
    requestedBy: uuid("requested_by"),
    files: integer("files").notNull().default(0),
    rows: bigint("rows", { mode: "number" }).notNull().default(0),
    /** The exact size of the `.shopper` file the parts assemble into. */
    bytes: bigint("bytes", { mode: "number" }).notNull().default(0),
    manifestSha256: text("manifest_sha256"),
    /** Files the rows point at that storage no longer holds; named in the audit row, absent from the archive. */
    missingBlobs: integer("missing_blobs").notNull().default(0),
    error: text("error"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    foreignKey({ columns: [t.orgId, t.requestedBy], foreignColumns: [user.orgId, user.id] }),
  ],
);

/**
 * The key archives are signed with, one per org, created at its first export. It lives in the database (like
 * `session_key`) so a restored box signs with the same key, and it is never exported.
 */
export const archiveKey = pgTable(
  "archive_key",
  {
    ...tenant(),
    privateKey: text("private_key").notNull(),
    publicKey: text("public_key").notNull(),
  },
  (t) => [unique().on(t.orgId)],
);
