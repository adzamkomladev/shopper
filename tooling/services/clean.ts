import { readdir, rm } from "node:fs/promises";
import { Client, escapeIdentifier } from "pg";
import { BUILT_APPS, RUNS } from "../e2e/run";
import { dropBucket, listBuckets, TASK_BUCKET } from "../storage/buckets";

/**
 * `vp run services:clean [--list]`: drops what crashed or interrupted test runs left on the shared
 * dev containers: per-file `shopper_test_*` and per-run `shopper_<id>_e2e` databases, per-file and
 * per-run buckets, and run folders. Work still in flight is kept: anything under an hour old
 * (an e2e database sits idle while its run builds) and any database with an open connection.
 */
const listOnly = process.argv.includes("--list");
const GRACE_MS = 60 * 60 * 1000;

const connectionString =
  process.env.TEST_DATABASE_URL ?? "postgresql://shopper:shopper_dev_only@127.0.0.1:5432/shopper";
if (!process.env.CI && !["localhost", "127.0.0.1"].includes(new URL(connectionString).hostname))
  throw new Error("Refusing to clean a database server that is not local");

const admin = new Client({ connectionString });
await admin.connect();
try {
  // A database's creation time is its PG_VERSION file's (reading it needs the dev superuser).
  const databases = await admin.query<{ name: string; connections: number; created: Date }>(
    `SELECT datname AS name,
       (SELECT count(*)::int FROM pg_stat_activity a WHERE a.datname = d.datname) AS connections,
       (pg_stat_file('base/' || oid || '/PG_VERSION')).modification AS created
     FROM pg_database d
     WHERE datname ~ '^shopper_test_[0-9a-f]{32}$' OR datname ~ '^shopper_[a-z0-9]{1,20}_e2e$'
     ORDER BY datname`,
  );
  for (const database of databases.rows) {
    if (database.connections) {
      console.log(`keep  database ${database.name} (${database.connections} open connections)`);
      continue;
    }
    if (Date.now() - database.created.getTime() < GRACE_MS) {
      console.log(`keep  database ${database.name} (under an hour old)`);
      continue;
    }
    console.log(`${listOnly ? "stale" : "drop "} database ${database.name}`);
    if (!listOnly)
      await admin.query(`DROP DATABASE IF EXISTS ${escapeIdentifier(database.name)} WITH (FORCE)`);
  }
  const live = await admin.query<{ id: string }>(
    `SELECT substring(datname from '^shopper_([a-z0-9]+)_e2e$') AS id FROM pg_database
     WHERE datname ~ '^shopper_[a-z0-9]{1,20}_e2e$'`,
  );
  await cleanFolders(new Set(live.rows.map((row) => row.id)));
} finally {
  await admin.end();
}

for (const bucket of (await listBuckets()).filter((bucket) => TASK_BUCKET.test(bucket.name))) {
  if (Date.now() - bucket.created.getTime() < GRACE_MS) {
    console.log(`keep  bucket ${bucket.name} (under an hour old)`);
    continue;
  }
  console.log(`${listOnly ? "stale" : "drop "} bucket ${bucket.name}`);
  if (!listOnly) await dropBucket(bucket.name);
}

/** Run folders whose run has no database left: `.shopper/runs/<id>` and `<app>/.runs/<id>`. */
async function cleanFolders(liveRuns: Set<string>) {
  for (const parent of [RUNS, ...BUILT_APPS.map((app) => `${app}/.runs`)]) {
    const ids = await readdir(parent).catch(() => []);
    for (const id of ids.filter((id) => !liveRuns.has(id))) {
      console.log(`${listOnly ? "stale" : "drop "} folder ${parent}/${id}`);
      if (!listOnly) await rm(`${parent}/${id}`, { recursive: true, force: true });
    }
  }
}
