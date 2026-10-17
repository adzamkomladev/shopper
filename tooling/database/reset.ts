import { sql } from "drizzle-orm";
import type { ShopperDatabase } from "../../packages/db/pg/src/index";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/** Throws unless the target may be wiped: local always, remote only with --yes outside production. */
export function assertResettable(url: string, yes: boolean, environment = "") {
  const target = new URL(url);
  if (LOCAL_HOSTS.includes(target.hostname)) return;
  if (!yes)
    throw new Error(`Refusing to reset ${target.hostname}: not a local database. Pass --yes.`);
  if (environment.toLowerCase().startsWith("prod"))
    throw new Error(`Refusing to reset ${target.hostname}: SHOPPER_ENVIRONMENT is production.`);
}

/** Drops every application table and the drizzle journal; the caller migrates afterwards. */
export async function resetSchemas(db: ShopperDatabase) {
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
}
