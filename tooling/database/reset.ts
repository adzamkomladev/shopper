import { sql } from "drizzle-orm";
import { Client } from "pg";
import type { ShopperDatabase } from "../../packages/db/pg/src/index";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];

/**
 * Throws unless `db:reset`/`db:seed` may write to the target. The host comes from pg's own
 * connection-string parsing (so `?host=` overrides cannot disguise a remote server as localhost).
 * Local servers and unix sockets are always allowed. A remote server needs `--confirm <host>` that
 * matches exactly, and anything that looks like production is refused outright.
 */
export function assertWritable(url: string, confirm: string | undefined, environment = "") {
  const { host, database } = target(url);
  if (LOCAL_HOSTS.includes(host) || host.startsWith("/")) return { host, database };
  if (/prod/i.test(environment) || /prod/i.test(host) || /prod/i.test(database))
    throw new Error(`Refusing to write to ${host}/${database}: it looks like production.`);
  if (confirm !== host)
    throw new Error(
      `Refusing to write to ${host}/${database}: not a local database. Pass --confirm ${host}.`,
    );
  return { host, database };
}

/** Host and database exactly as the pg driver will resolve them; never connects. */
export function target(url: string) {
  const client = new Client({ connectionString: url });
  return { host: String(client.host ?? ""), database: String(client.database ?? "") };
}

/** Drops every application table and the drizzle journal; the caller migrates afterwards. */
export async function resetSchemas(db: ShopperDatabase) {
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
}
