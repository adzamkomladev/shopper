import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { branch, device, user } from "@shopper/db-pg";
import type { Queryable } from "../types";
import type { AuditDetail, AuditItem, ScopedAuditFilters } from "./types";

/**
 * One page of the merged log (the org chain and every uploaded register chain), newest first by UUIDv7, with the
 * actor, approver, device and branch named. `next` is the cursor for the following page, or null at the end.
 */
export async function listAudit(db: Queryable, orgId: string, filters: ScopedAuditFilters) {
  const rows = await select(db, orgId, filters, filters.limit + 1);
  return {
    entries: rows.slice(0, filters.limit).map(item),
    next: rows.length > filters.limit ? rows[filters.limit - 1]!.id : null,
  };
}

/** `listAudit` with each entry's full detail, for exports. */
export async function listAuditDetails(db: Queryable, orgId: string, filters: ScopedAuditFilters) {
  const rows = await select(db, orgId, filters, filters.limit + 1);
  return {
    entries: rows.slice(0, filters.limit).map(detail),
    next: rows.length > filters.limit ? rows[filters.limit - 1]!.id : null,
  };
}

/** One entry with what it changed, its payload and its place in its chain. */
export async function readAudit(db: Queryable, orgId: string, id: string, scope?: string[]) {
  const [row] = await select(db, orgId, { scope }, 1, sql`e.id = ${id}::uuid`);
  return row ? detail(row) : null;
}

/** What the filters can offer: members, registers and branches by name, and the commands, entities and roles seen. */
export async function auditFacets(db: Queryable, orgId: string, scope?: string[]) {
  const seen = (column: "command" | "entity" | "role") =>
    db
      .execute<{ value: string }>(
        sql`SELECT DISTINCT ${sql.raw(column)} AS value FROM (${merged(orgId)}) e
            WHERE ${sql.raw(column)} IS NOT NULL ORDER BY 1`,
      )
      .then((result) => result.rows.map((row) => row.value));
  const [actors, devices, branches, commands, entities, roles] = await Promise.all([
    db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(eq(user.orgId, orgId))
      .orderBy(user.name),
    db
      .select({ id: device.id, name: device.name })
      .from(device)
      .where(and(eq(device.orgId, orgId), scope ? inArray(device.branchId, scope) : undefined))
      .orderBy(device.name),
    db
      .select({ id: branch.id, name: branch.name })
      .from(branch)
      .where(and(eq(branch.orgId, orgId), scope ? inArray(branch.id, scope) : undefined))
      .orderBy(branch.name),
    seen("command"),
    seen("entity"),
    seen("role"),
  ]);
  return { actors, devices, branches, commands, entities, roles };
}

type Row = {
  id: string;
  stream: string;
  seq: string | number;
  created_at: Date | string;
  device_time: Date | string | null;
  command: string;
  entity: string | null;
  entity_id: string | null;
  role: string | null;
  reason: string | null;
  actor_id: string | null;
  actor_name: string | null;
  approver_id: string | null;
  approver_name: string | null;
  device_id: string | null;
  device_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  stream_name: string | null;
  before: unknown;
  after: unknown;
  payload: Record<string, unknown>;
  hash: string;
  prev_hash: string;
  app_version: string;
};

function detail(row: Row): AuditDetail {
  return {
    ...item(row),
    before: row.before,
    after: row.after,
    payload: row.payload,
    hash: row.hash,
    prevHash: row.prev_hash,
    appVersion: row.app_version,
  };
}

function item(row: Row): AuditItem {
  const named = (id: string | null, name: string | null) => (id ? { id, name } : null);
  return {
    id: row.id,
    stream: row.stream,
    streamName: row.stream === "org" ? null : row.stream_name,
    seq: Number(row.seq),
    at: new Date(row.created_at).toISOString(),
    deviceTime: row.device_time && new Date(row.device_time).toISOString(),
    command: row.command,
    entity: row.entity,
    entityId: row.entity_id,
    role: row.role,
    reason: row.reason,
    actor: named(row.actor_id, row.actor_name),
    approver: named(row.approver_id, row.approver_name),
    device: named(row.device_id, row.device_name),
    branch: named(row.branch_id, row.branch_name),
  };
}

// Both chains in one shape. A register row with no recorded device belongs to the register that uploaded it.
const merged = (orgId: string) => sql`
  SELECT id, 'org'::text AS stream, chain_seq AS seq, created_at, device_time, command, entity,
         entity_id::text AS entity_id, role, reason, actor_id, approver_id, device_id, branch_id,
         before, after, payload, hash, prev_hash, app_version
    FROM audit_log WHERE org_id = ${orgId} AND chain_seq IS NOT NULL
  UNION ALL
  SELECT id, stream_id::text, chain_seq, created_at, device_time, command, entity,
         entity_id, role, reason, actor_id, approver_id, coalesce(device_id, stream_id), branch_id,
         before, after, payload, hash, prev_hash, app_version
    FROM device_audit WHERE org_id = ${orgId}`;

async function select(
  db: Queryable,
  orgId: string,
  filters: Partial<ScopedAuditFilters>,
  limit: number,
  extra?: SQL,
) {
  const where = [
    extra,
    filters.actor && sql`e.actor_id = ${filters.actor}`,
    filters.role && sql`e.role = ${filters.role}`,
    filters.device && sql`(e.device_id = ${filters.device} OR e.stream = ${filters.device})`,
    filters.branch && sql`e.branch_id = ${filters.branch}`,
    // Entries with no branch (org-level changes) are outside every branch scope.
    filters.scope &&
      sql`e.branch_id IN (${sql.join(
        filters.scope.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`,
    filters.entity && sql`e.entity = ${filters.entity}`,
    filters.entityId && sql`e.entity_id = ${filters.entityId}`,
    filters.command && sql`e.command = ${filters.command}`,
    filters.from && sql`e.created_at >= ${filters.from.toISOString()}`,
    filters.to && sql`e.created_at < ${filters.to.toISOString()}`,
    filters.cursor && sql`e.id < ${filters.cursor}::uuid`,
  ].filter((clause): clause is SQL => Boolean(clause));
  const result = await db.execute<Row>(sql`
    SELECT e.*, a.name AS actor_name, p.name AS approver_name, d.name AS device_name,
           b.name AS branch_name, s.name AS stream_name
      FROM (${merged(orgId)}) e
      LEFT JOIN "user" a ON a.org_id = ${orgId} AND a.id = e.actor_id
      LEFT JOIN "user" p ON p.org_id = ${orgId} AND p.id = e.approver_id
      LEFT JOIN device d ON d.org_id = ${orgId} AND d.id = e.device_id
      LEFT JOIN device s ON s.org_id = ${orgId} AND s.id::text = e.stream
      LEFT JOIN branch b ON b.org_id = ${orgId} AND b.id = e.branch_id
     WHERE ${where.length ? sql.join(where, sql` AND `) : sql`TRUE`}
     ORDER BY e.id DESC
     LIMIT ${limit}`);
  return result.rows;
}
