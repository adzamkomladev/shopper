import { sql } from "drizzle-orm";
import type { ShopperDatabase } from "@shopper/db-pg";

type Table = { schema: string; name: string };
// A's own log may quote an id A typed; that is A's input, not B's data.
const OWN_RECORDS = new Set(["audit_log", "audit_chain"]);

/** Every table that carries org_id: the shape of tenant data, read from the database, not from a list. */
export async function orgTables(db: ShopperDatabase) {
  const result = await db.execute<{ schema: string; name: string }>(sql`
    SELECT table_schema AS schema, table_name AS name FROM information_schema.columns
    WHERE column_name = 'org_id' AND table_schema NOT IN ('pg_catalog', 'information_schema')
      AND table_name IN (SELECT table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE')
    ORDER BY 1, 2`);
  return result.rows;
}

/** One id from each of the org's tables that has rows, plus the org id itself. */
export async function idsOf(db: ShopperDatabase, tables: Table[], orgId: string) {
  const ids = new Set([orgId.toLowerCase()]);
  for (const table of tables.filter((table) => !OWN_RECORDS.has(table.name))) {
    const hasId = await db.execute(sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = ${table.schema} AND table_name = ${table.name} AND column_name = 'id'`);
    if (!hasId.rows.length) continue;
    const found = await db.execute<{ id: string }>(
      sql`SELECT id::text AS id FROM ${ref(table)} WHERE org_id = ${orgId} LIMIT 1`,
    );
    for (const row of found.rows)
      if (/^[0-9a-f-]{36}$/i.test(row.id)) ids.add(row.id.toLowerCase());
  }
  return [...ids];
}

/** Which of `ids` the org now holds as its own row ids: a client may choose an id another shop also uses. */
export async function heldBy(db: ShopperDatabase, tables: Table[], orgId: string, ids: string[]) {
  const held = new Set<string>();
  for (const table of tables) {
    const hasId = await db.execute(sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = ${table.schema} AND table_name = ${table.name} AND column_name = 'id'`);
    if (!hasId.rows.length) continue;
    const found = await db.execute<{ id: string }>(sql`
      SELECT id::text AS id FROM ${ref(table)}
      WHERE org_id = ${orgId} AND lower(id::text) = ANY(${`{${ids.join(",")}}`}::text[])`);
    for (const row of found.rows) held.add(row.id.toLowerCase());
  }
  return held;
}

/** A digest of every row the org owns, table by table: any write by another shop changes it. */
export async function digestOf(db: ShopperDatabase, tables: Table[], orgId: string) {
  const digests: Record<string, string> = {};
  for (const table of tables) {
    const result = await db.execute<{ digest: string }>(sql`
      SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) AS digest
      FROM ${ref(table)} t WHERE org_id = ${orgId}`);
    digests[`${table.schema}.${table.name}`] = result.rows[0]!.digest;
  }
  return digests;
}

/** Rows of `orgId` that mention any of `ids`: one shop's data pointing into another's. */
export async function referencesTo(
  db: ShopperDatabase,
  tables: Table[],
  orgId: string,
  ids: string[],
) {
  const pattern = ids.join("|");
  const found: string[] = [];
  for (const table of tables.filter((table) => !OWN_RECORDS.has(table.name))) {
    const result = await db.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM ${ref(table)} t
      WHERE org_id = ${orgId} AND lower(t::text) ~ ${pattern}`);
    if (result.rows[0]!.count) found.push(`${table.schema}.${table.name}`);
  }
  return found;
}

const ref = (table: Table) => sql.raw(`"${table.schema}"."${table.name}"`);
