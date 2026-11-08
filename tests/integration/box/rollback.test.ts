// Notion Day 39 drill: after a failed update is switched back, the old box's `rollback` restores the verified dump kept
// just before the update when the update's migrations ran, and leaves the database alone when they did not.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client, Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
import { backupBox, rollbackDatabase } from "@shopper/box";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { postgresFixture } from "../../fixtures/postgres";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let dir: string;
let recipient: string;
const name = () => new URL(fixture.connectionString).pathname.slice(1);
const query = async (sql: string) => {
  const client = new Client({ connectionString: fixture.connectionString });
  await client.connect();
  try {
    return (await client.query(sql)).rows;
  } finally {
    await client.end();
  }
};

beforeAll(async () => {
  fixture = await postgresFixture();
  // The rollback closes every connection to the shop's database, this fixture's idle one included.
  fixture.client.on("error", () => undefined);
  const pool = new Pool({ connectionString: fixture.connectionString });
  await migrateDatabase(drizzle(pool, { schema }));
  const shop = provisioningContext();
  await provisionOrg(drizzle(pool, { schema }), shop, {
    name: "Rollback box",
    slug: `box-${shop.orgId.slice(-12)}`,
  });
  await pool.end();
  dir = await mkdtemp(join(tmpdir(), "shopper-box-rollback-"));
  execFileSync("age-keygen", ["-o", join(dir, "identity.txt")], { stdio: "ignore" });
  recipient = (await readFile(join(dir, "identity.txt"), "utf8")).match(/age1[0-9a-z]+/)![0];
}, 120_000);
afterAll(async () => {
  const leftovers = (await query(
    `select datname from pg_database where datname like '${name()}_%'`,
  )) as Array<{ datname: string }>;
  for (const row of leftovers) await query(`DROP DATABASE "${row.datname}" WITH (FORCE)`);
  await fixture?.close();
  if (dir) await rm(dir, { recursive: true, force: true });
});

const keepBackup = () =>
  backupBox({
    databaseUrl: fixture.connectionString,
    recipient,
    remote: join(dir, "remote"),
    workDir: join(dir, "work"),
    keep: join(dir, "pre-update.dump"),
  });

test("a migration that failed changed nothing: the database stays, and the kept dump is removed", async () => {
  await keepBackup();
  expect((await stat(join(dir, "pre-update.dump"))).mode & 0o777).toBe(0o600);
  const before = await query("select count(*)::int as n from drizzle.__drizzle_migrations");
  expect(await rollbackDatabase(fixture.connectionString, join(dir, "pre-update.dump"))).toBe(
    "The update changed nothing in the database.",
  );
  expect(await query("select count(*)::int as n from drizzle.__drizzle_migrations")).toEqual(
    before,
  );
  await expect(stat(join(dir, "pre-update.dump"))).rejects.toThrow();
});

test("migrations that ran are undone: the kept dump becomes the shop's database, the changed one is kept aside", async () => {
  await keepBackup();
  const [{ n: migrations }] = await query(
    "select count(*)::int as n from drizzle.__drizzle_migrations",
  );
  const [{ n: orgs }] = await query("select count(*)::int as n from org");
  // What the update's migration did before its box failed health.
  await query("create table update_only (id int)");
  await query("insert into drizzle.__drizzle_migrations (hash, created_at) values ('next', 1)");

  const said = await rollbackDatabase(fixture.connectionString, join(dir, "pre-update.dump"));
  expect(said).toMatch(
    new RegExp(`^The database was restored .*kept as ${name()}_failed_\\d{8}t\\d{6}z\\.$`),
  );
  expect(await query("select count(*)::int as n from drizzle.__drizzle_migrations")).toEqual([
    { n: migrations },
  ]);
  expect(await query("select count(*)::int as n from org")).toEqual([{ n: orgs }]);
  expect(await query("select to_regclass('update_only') as t")).toEqual([{ t: null }]);
  await expect(stat(join(dir, "pre-update.dump"))).rejects.toThrow();
});

test("an old box with no kept dump leaves the database as it is", async () => {
  expect(await rollbackDatabase(fixture.connectionString, join(dir, "none.dump"))).toBe(
    "No backup was kept before the update, so the database was left as it is.",
  );
});
