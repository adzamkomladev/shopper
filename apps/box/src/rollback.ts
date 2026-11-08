import { execFile } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { promisify } from "node:util";
import { Client } from "pg";

const run = promisify(execFile);

/**
 * After a failed update has been switched back (deploy/bin/shopper-apply, box stopped): when the update's migrations
 * ran, the database no longer fits the old box, so the verified dump taken just before the update is restored into a
 * fresh database that takes the shop's name. The changed one is kept as `<name>_failed_<time>` for support. A migration
 * that failed changed nothing (they run in one transaction), so then only the dump is removed. Returns one sentence.
 */
export async function rollbackDatabase(databaseUrl: string, dump: string) {
  const kept = await readFile(`${dump}.json`, "utf8").then(
    (text) => JSON.parse(text) as { migrations: number },
    () => undefined,
  );
  if (!kept) return "No backup was kept before the update, so the database was left as it is.";
  const url = new URL(databaseUrl);
  const name = decodeURIComponent(url.pathname.slice(1));
  const applied = await migrations(url.toString());
  if (applied === kept.migrations) {
    await forget(dump);
    return "The update changed nothing in the database.";
  }
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]|\.\d+/g, "")
    .toLowerCase();
  const fresh = new URL(url);
  fresh.pathname = `/${name}_restore_${stamp}`;
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}_restore_${stamp}"`);
    await run("pg_restore", ["--exit-on-error", "--no-owner", "-d", fresh.toString(), dump]);
    const restored = await migrations(fresh.toString());
    if (restored !== kept.migrations)
      throw new Error(`The kept backup has ${restored} migrations, not ${kept.migrations}`);
  } finally {
    await admin.end();
  }
  // Renaming needs every connection to the shop's database closed, including this one: work from the restored one.
  const swap = new Client({ connectionString: fresh.toString() });
  await swap.connect();
  try {
    await swap.query("select pg_terminate_backend(pid) from pg_stat_activity where datname = $1", [
      name,
    ]);
    await swap.query(`ALTER DATABASE "${name}" RENAME TO "${name}_failed_${stamp}"`);
  } finally {
    await swap.end();
  }
  const admin2 = new Client({
    connectionString: new URL(`/${name}_failed_${stamp}`, url).toString(),
  });
  await admin2.connect();
  try {
    await admin2.query(`ALTER DATABASE "${name}_restore_${stamp}" RENAME TO "${name}"`);
  } finally {
    await admin2.end();
  }
  await forget(dump);
  return `The database was restored from the backup taken before the update; the changed one is kept as ${name}_failed_${stamp}.`;
}

async function migrations(connectionString: string) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query<{ n: number }>(
      "select count(*)::int as n from drizzle.__drizzle_migrations",
    );
    return rows[0]!.n;
  } finally {
    await client.end();
  }
}

const forget = (dump: string) =>
  Promise.all([rm(dump, { force: true }), rm(`${dump}.json`, { force: true })]);
