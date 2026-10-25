import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  foreignKey,
  index,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenant } from "./base";
import { device } from "./devices";
import { auditFields } from "./workflows";

/**
 * A till's own audit chain as it uploaded it, row for row: the till hashed these, so the server stores them verbatim
 * (no actor or branch keys, which must never make a valid chain unstorable) and only appends after the stored head.
 */
export const deviceAudit = pgTable(
  "device_audit",
  {
    ...tenant(),
    ...auditFields(),
    deviceId: uuid("device_id").notNull(),
    chainSeq: bigint("chain_seq", { mode: "number" }).notNull(),
    prevHash: text("prev_hash").notNull(),
    hash: text("hash").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.deviceId, t.chainSeq),
    foreignKey({ columns: [t.orgId, t.deviceId], foreignColumns: [device.orgId, device.id] }),
    check(
      "device_audit_chain_shape",
      sql`${t.hash} ~ '^[0-9a-f]{64}$' AND ${t.prevHash} ~ '^[0-9a-f]{64}$' AND ${t.chainSeq} > 0`,
    ),
    index("device_audit_viewer").on(t.orgId, t.id),
    index("device_audit_entity").on(t.orgId, t.entity, t.entityId),
    index("device_audit_actor").on(t.orgId, t.actorId),
    index("device_audit_command").on(t.orgId, t.command),
  ],
);

/** A chain head published at the end of a day: `stream` is `org` or a device id. Later rewrites cannot match it. */
export const auditAnchor = pgTable(
  "audit_anchor",
  {
    ...tenant(),
    day: date("day").notNull(),
    stream: text("stream").notNull(),
    chainSeq: bigint("chain_seq", { mode: "number" }).notNull(),
    hash: text("hash").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.day, t.stream),
    index("audit_anchor_stream").on(t.orgId, t.stream, t.chainSeq),
    check("audit_anchor_hash", sql`${t.hash} ~ '^[0-9a-f]{64}$' AND ${t.chainSeq} >= 0`),
  ],
);
