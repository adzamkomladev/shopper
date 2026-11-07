import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";

/**
 * The box's nightly backup: `pg_dump` of one snapshot, restored into a scratch database and counted table by table
 * against that same snapshot, then `age`-encrypted to Shopper's recipient and copied with `rclone` (R2 in
 * production). A difference in any count uploads nothing. The box never holds the age identity, and the plaintext
 * dump never leaves `workDir`. Run by the systemd timer (`cli/backup.ts`, `deploy/systemd/`).
 */
export async function backupBox(options: {
  databaseUrl: string;
  /** The age public key (age1…) the dump is encrypted to. */
  recipient: string;
  /** An rclone destination folder: `r2:shopper-backups/<site>`, or a local path. */
  remote: string;
  workDir: string;
  now?: Date;
}) {
  const stamp = (options.now ?? new Date()).toISOString().replace(/[-:]|\.\d+/g, "");
  const dump = join(options.workDir, `shopper-${stamp}.dump`);
  const file = `${dump.slice(options.workDir.length + 1)}.age`;
  await mkdir(options.workDir, { recursive: true });
  try {
    const counts = await dumpSnapshot(options.databaseUrl, dump);
    await restoreAndCount(options.databaseUrl, dump, stamp, counts);
    await run("age", ["-r", options.recipient, "-o", `${dump}.age`, dump]);
    await run("rclone", ["copyto", `${dump}.age`, `${options.remote}/${file}`]);
    return { file, counts };
  } finally {
    await rm(dump, { force: true });
    await rm(`${dump}.age`, { force: true });
  }
}

/** Counts every table and dumps inside one exported snapshot, so a sale mid-backup cannot skew the comparison. */
async function dumpSnapshot(databaseUrl: string, dump: string) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const { rows } = await client.query<{ snapshot: string }>(
      "select pg_export_snapshot() as snapshot",
    );
    const counts = await countTables(client);
    await run("pg_dump", ["--snapshot", rows[0]!.snapshot, "-Fc", "-f", dump, databaseUrl]);
    await client.query("COMMIT");
    return counts;
  } finally {
    await client.end();
  }
}

async function restoreAndCount(
  databaseUrl: string,
  dump: string,
  stamp: string,
  expected: Record<string, number>,
) {
  const scratch = `shopper_restore_${stamp.toLowerCase()}`;
  const admin = new Client({ connectionString: databaseUrl });
  await admin.connect();
  const url = new URL(databaseUrl);
  url.pathname = `/${scratch}`;
  try {
    await admin.query(`CREATE DATABASE "${scratch}"`);
    await run("pg_restore", ["--exit-on-error", "--no-owner", "-d", url.toString(), dump]);
    const restored = new Client({ connectionString: url.toString() });
    await restored.connect();
    const actual = await countTables(restored).finally(() => restored.end());
    const differs = Object.keys({ ...expected, ...actual }).filter(
      (table) => expected[table] !== actual[table],
    );
    if (differs.length > 0)
      throw new Error(
        `The restored backup differs: ${differs.map((t) => `${t} ${expected[t]}≠${actual[t]}`).join(", ")}`,
      );
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS "${scratch}" WITH (FORCE)`);
    await admin.end();
  }
}

/** Rows per table, keyed `table` in public and `schema.table` elsewhere (drizzle's migrations journal). */
async function countTables(client: Client) {
  const { rows } = await client.query<{ name: string; sql: string }>(
    `select case when schemaname = 'public' then tablename else schemaname || '.' || tablename end as name,
            format('select count(*)::int as n from %I.%I', schemaname, tablename) as sql
       from pg_tables where schemaname not in ('pg_catalog', 'information_schema') order by 1`,
  );
  const counts: Record<string, number> = {};
  for (const table of rows) counts[table.name] = (await client.query(table.sql)).rows[0].n;
  return counts;
}

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}: ${stderr.trim()}`)),
    );
  });
}
