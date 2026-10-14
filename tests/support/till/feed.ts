// Setup for the store change feed suites: one migrated database, a fresh org with stores per test.
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shopper/db-pg";
import { mutateManagement } from "@shopper/core/management";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { postgresFixture } from "../../fixtures/postgres";

export type FeedRow = {
  store_id: string;
  seq: string;
  entity: string;
  entity_id: string;
  op: string;
  v: number;
  payload: Record<string, unknown>;
};
// Resolved at call time so a missing `@shopper/core/changes` fails only the tests that call it.
const changesModule = "@shopper/core/changes";
export const loadRecordChanges = async () =>
  (await import(/* @vite-ignore */ changesModule)).recordChanges as (
    tx: unknown,
    orgId: string,
    changes: { entity: string; entityId: string; op: string; payload: unknown }[],
    storeIds: string[],
  ) => Promise<void>;

export async function openFeed() {
  const fixture = await postgresFixture();
  const pool = new Pool({ connectionString: fixture.connectionString, max: 6 });
  const db = drizzle(pool, { schema });
  await migrateDatabase(db);

  /** A provisioned org with `storeCount` stores and one branch inside the first store. */
  async function world(storeCount = 3) {
    const context = { ...provisioningContext(), reason: "Feed test" };
    await provisionOrg(db, context, { name: "Feed org" });
    const stores: string[] = [];
    for (let i = 0; i < storeCount; i++) {
      const made = await mutateManagement(db, context, {
        kind: "store",
        action: "create",
        data: { name: `Feed store ${i + 1}` },
      });
      stores.push(made.id);
    }
    const made = await mutateManagement(db, context, {
      kind: "branch",
      action: "create",
      data: { name: "Feed branch", storeId: stores[0] },
    });
    return { context, orgId: context.orgId, stores, branchId: made.id };
  }

  /** Feed rows of an org (optionally one store, one entity) in cursor order. Reads SQL, not Drizzle, so the seq type is irrelevant. */
  async function changes(orgId: string, filter: { storeId?: string; entity?: string } = {}) {
    const { rows } = await pool.query<FeedRow>(
      `SELECT store_id, seq::text, entity, entity_id, op, v, payload FROM store_change
       WHERE org_id = $1 AND ($2::uuid IS NULL OR store_id = $2) AND ($3::text IS NULL OR entity = $3)
       ORDER BY store_id, store_change.seq`,
      [orgId, filter.storeId ?? null, filter.entity ?? null],
    );
    return rows;
  }

  async function lastSeq(orgId: string, storeId: string) {
    const { rows } = await pool.query<{ seq: string }>(
      "SELECT last_seq::text AS seq FROM store WHERE org_id = $1 AND id = $2",
      [orgId, storeId],
    );
    return BigInt(rows[0]!.seq);
  }

  const auditRows = (orgId: string, command: string) =>
    db
      .select()
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.orgId, orgId), eq(schema.auditLog.command, command)));

  return {
    db,
    world,
    changes,
    lastSeq,
    auditRows,
    async close() {
      await pool.end();
      await fixture.close();
    },
  };
}
