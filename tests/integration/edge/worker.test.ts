import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "vite-plus/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrateDatabase } from "../../../tooling/migrate";
import { postgresFixture } from "../../fixtures/postgres";
import * as schema from "@shopper/db-pg";
import { asc } from "drizzle-orm";
import { verifyChain } from "@shopper/audit";
const exec = promisify(execFile);
test("Worker integration and shared conformance suite pass in workerd", async () => {
  const fixture = await postgresFixture();
  try {
    const db = drizzle(fixture.client, { schema });
    await migrateDatabase(db);
    const { stdout } = await exec("node", ["node_modules/vitest/vitest.mjs", "run"], {
      cwd: new URL("../../../tooling/worker-tests/", import.meta.url),
      env: { ...process.env, CF_TEST_DATABASE_URL: fixture.connectionString },
      timeout: 100000,
    });
    expect(stdout).toContain("12 passed");
    const rows = await db.select().from(schema.auditLog).orderBy(asc(schema.auditLog.chainSeq));
    for (const orgId of new Set(rows.map((row) => row.orgId))) {
      expect(await verifyChain(rows.filter((row) => row.orgId === orgId))).toMatchObject({
        valid: true,
      });
    }
  } finally {
    await fixture.close();
  }
}, 120000);
