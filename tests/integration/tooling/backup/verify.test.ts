// A restored copy of the record is trusted only once its schema is complete and every audit stream verifies.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { verifyBackup } from "../../../../tooling/backup/verify";
import { migrateDatabase } from "../../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../../tooling/database/seed";
import { postgresFixture } from "../../../fixtures/postgres";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let db: schema.ShopperDatabase;
const shop = provisioningContext();

beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  await migrateDatabase(db);
  await provisionOrg(db, shop, { name: "Backup shop", slug: `backup-${shop.orgId.slice(-12)}` });
});
afterAll(async () => {
  await pool?.end();
  await fixture?.close();
});

/** Runs SQL with the history triggers off, as a bad restore or someone with database access would. */
async function raw(text: string, values: unknown[] = []) {
  const client = await pool.connect();
  try {
    await client.query("SET session_replication_role = replica");
    await client.query(text, values);
  } finally {
    client.release();
  }
}

test("a complete restore passes, naming what it checked", async () => {
  const report = await verifyBackup(db);
  expect(report.failures).toEqual([]);
  expect(report.orgs).toBeGreaterThanOrEqual(1);
  expect(report.entries).toBeGreaterThan(0);
});

test("an edited audit row fails and names the shop", async () => {
  const where = `org_id = $1 and chain_seq = 1`;
  const { rows } = await pool.query(`select after from audit_log where ${where}`, [shop.orgId]);
  await raw(`update audit_log set after = '{"name":"Forged"}' where ${where}`, [shop.orgId]);
  try {
    expect((await verifyBackup(db)).failures).toEqual([
      expect.stringMatching(new RegExp(`^${shop.orgId} org: `)),
    ]);
  } finally {
    await raw(`update audit_log set after = $2 where ${where}`, [shop.orgId, rows[0].after]);
  }
});

test("a restore missing a migration fails", async () => {
  await db.execute(sql`create table drizzle.held as select * from drizzle.__drizzle_migrations`);
  await db.execute(
    sql`delete from drizzle.__drizzle_migrations where created_at = (select max(created_at) from drizzle.__drizzle_migrations)`,
  );
  try {
    expect((await verifyBackup(db)).failures).toContain(
      "schema: the restore is missing migrations this build expects",
    );
  } finally {
    await db.execute(sql`delete from drizzle.__drizzle_migrations`);
    await db.execute(sql`insert into drizzle.__drizzle_migrations select * from drizzle.held`);
    await db.execute(sql`drop table drizzle.held`);
  }
});
