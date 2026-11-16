import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { tenant } from "./base";

export const importStatuses = ["uploading", "importing", "ready", "failed"] as const;
export const moveStatuses = ["sealing", "uploading", "importing", "moved", "failed"] as const;
export const boxMoveStatuses = ["open", "claimed", "archived", "cancelled"] as const;

/** A relocation code a till redeems once with the cloud, stored hashed. */
export type RelocationCode = { codeHash: string; expiresAt: string; usedAt: string | null };

/** What a move carries besides the archive: credentials, never written to the `.shopper` file. */
export type MoveCredentials = {
  passwords: { userId: string; password: string }[];
  pins: { userId: string; pinHash: string }[];
  sessionKey: string | null;
};

const times = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The cloud's side of a box moving in: its manifest, which files have arrived, and the relocation codes its tills
 * redeem. `org_id` is the archive's org and has no foreign key: the org only exists once the import commits.
 * Never archived.
 */
export const archiveImport = pgTable(
  "archive_import",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    orgId: uuid("org_id").notNull(),
    ...times(),
    status: text("status", { enum: importStatuses }).notNull().default("uploading"),
    licenceId: uuid("licence_id").notNull(),
    manifest: jsonb("manifest").notNull(),
    signature: text("signature").notNull(),
    received: jsonb("received").$type<string[]>().notNull().default([]),
    /** Set by the commit, cleared once the import applied them (or failed). */
    credentials: jsonb("credentials").$type<MoveCredentials>(),
    relocations: jsonb("relocations").$type<Record<string, RelocationCode>>().notNull().default({}),
    error: text("error"),
    /** The box's verification report on arrival (a box's own record of moving in from the cloud). */
    report: jsonb("report"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [unique().on(t.orgId)],
);

/** The box's side of moving to the cloud: once a row exists the box is read-only. Never archived. */
export const cloudMove = pgTable(
  "cloud_move",
  {
    ...tenant(),
    status: text("status", { enum: moveStatuses }).notNull().default("sealing"),
    requestedBy: uuid("requested_by"),
    cloudUrl: text("cloud_url").notNull(),
    exportJobId: uuid("export_job_id"),
    importId: uuid("import_id"),
    /** Per device: the signed relocation message and when a handshake handed it over. */
    relocations: jsonb("relocations")
      .$type<Record<string, { message: string; deliveredAt: string | null }>>()
      .notNull()
      .default({}),
    error: text("error"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [unique().on(t.orgId)],
);

/**
 * The cloud's side of a shop moving onto its own box. While a row is open, claimed or archived the cloud org only
 * reads; archived is for good. The licence it issued, the codes its registers redeem on the box and the verification
 * report live here. Never archived.
 */
export const boxMove = pgTable(
  "box_move",
  {
    ...tenant(),
    status: text("status", { enum: boxMoveStatuses }).notNull().default("open"),
    requestedBy: uuid("requested_by"),
    exportJobId: uuid("export_job_id").notNull(),
    licenceId: uuid("licence_id"),
    /** The lic/1 issued for the box: public, signed by the issuer. */
    licence: jsonb("licence"),
    boxUpstream: text("box_upstream"),
    /** Per device: the signed relocation to the box and when a handshake handed it over. */
    relocations: jsonb("relocations")
      .$type<Record<string, { message: string; deliveredAt: string | null }>>()
      .notNull()
      .default({}),
    report: jsonb("report"),
    error: text("error"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [unique().on(t.orgId)],
);
