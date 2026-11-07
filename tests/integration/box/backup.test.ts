// The nightly box backup is trusted only once it restored into a scratch database with identical row counts.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
import { backupBox } from "@shopper/box";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { postgresFixture } from "../../fixtures/postgres";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let dir: string;

beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  const db = drizzle(pool, { schema });
  await migrateDatabase(db);
  const shop = provisioningContext();
  await provisionOrg(db, shop, { name: "Backup box", slug: `box-${shop.orgId.slice(-12)}` });
  dir = await mkdtemp(join(tmpdir(), "shopper-box-backup-"));
}, 120_000);
afterAll(async () => {
  await pool?.end();
  await fixture?.close();
  if (dir) await rm(dir, { recursive: true, force: true });
});

test("dump, restore and count, then only the encrypted dump goes to the remote", async () => {
  execFileSync("age-keygen", ["-o", join(dir, "identity.txt")], { stdio: "ignore" });
  const recipient = (await readFile(join(dir, "identity.txt"), "utf8")).match(/age1[0-9a-z]+/)![0];
  const work = join(dir, "work");
  const remote = join(dir, "remote");

  const report = await backupBox({
    databaseUrl: fixture.connectionString,
    recipient,
    remote,
    workDir: work,
  });

  const { rows } = await pool.query<{ count: number }>(
    "select count(*)::int as count from audit_log",
  );
  expect(report.counts.audit_log).toBe(rows[0]!.count);
  expect(report.counts.org).toBe(1);
  expect(Object.keys(report.counts).length).toBeGreaterThan(30);
  // Nothing is left behind: no plaintext dump, no scratch database.
  expect(await readdir(work)).toEqual([]);
  const scratch = await pool.query(
    "select 1 from pg_database where datname like 'shopper_restore_%'",
  );
  expect(scratch.rowCount).toBe(0);

  const uploaded = await readdir(remote);
  expect(uploaded).toEqual([report.file]);
  expect(report.file).toMatch(/^shopper-\d{8}T\d{6}Z\.dump\.age$/);
  // The remote copy is ciphertext that only the identity opens, into a dump pg_restore reads.
  const encrypted = join(remote, report.file);
  expect((await readFile(encrypted)).subarray(0, 21).toString()).toBe("age-encryption.org/v1");
  const plain = join(dir, "restored.dump");
  execFileSync("age", ["-d", "-i", join(dir, "identity.txt"), "-o", plain, encrypted]);
  expect(execFileSync("pg_restore", ["--list", plain]).toString()).toContain(
    "TABLE DATA public audit_log",
  );
}, 120_000);

test("a failed dump uploads nothing and drops nothing it did not create", async () => {
  const remote = join(dir, "remote-failed");
  const broken = new URL(fixture.connectionString);
  broken.pathname = "/shopper_no_such_database";
  await expect(
    backupBox({
      databaseUrl: broken.toString(),
      recipient: "age1qyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqs3290gq",
      remote,
      workDir: join(dir, "work-failed"),
    }),
  ).rejects.toThrow();
  await expect(readdir(remote)).rejects.toThrow();
});
