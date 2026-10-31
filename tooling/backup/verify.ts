import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { auditStreams, verifyStream } from "../../packages/core/src/audit/index";
import * as schema from "../../packages/db/pg/src/index";
import { buildDefines } from "../build/info";

/**
 * Checks a restored copy of the record (a Neon point-in-time branch, a pg_restore) before anyone trusts
 * it: every migration this build expects is applied, and every shop's audit streams verify end to end.
 * `vp exec tsx tooling/backup/verify.ts <database-url>` prints the report and exits 1 on any failure.
 */
export async function verifyBackup(db: schema.ShopperDatabase) {
  const failures: string[] = [];
  const { rows } = await db.execute<{ applied: number }>(
    sql`select count(*)::int as applied from drizzle.__drizzle_migrations`,
  );
  // The journal's idx counts from 0, so the build expects one more migration than SCHEMA_VERSION.
  if ((rows[0]?.applied ?? 0) <= Number(buildDefines.SCHEMA_VERSION))
    failures.push("schema: the restore is missing migrations this build expects");
  const orgs = await db.select({ id: schema.org.id }).from(schema.org);
  let entries = 0;
  for (const org of orgs)
    for (const stream of await auditStreams(db, org.id)) {
      const result = await verifyStream(db, org.id, stream.stream);
      if (result.valid) entries += result.count;
      else failures.push(`${org.id} ${stream.stream}: ${result.reason} at seq ${result.seq}`);
    }
  return { orgs: orgs.length, entries, failures };
}

if (import.meta.main) {
  const url = process.argv[2];
  if (!url) throw new Error("Usage: tsx tooling/backup/verify.ts <database-url>");
  const pool = new Pool({ connectionString: url });
  try {
    const report = await verifyBackup(drizzle(pool, { schema }));
    console.log(JSON.stringify(report, null, 2));
    if (report.failures.length > 0) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
