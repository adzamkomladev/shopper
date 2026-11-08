import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { ShopperDatabase } from "./types";

/** Runs the forward-only migrations in `folder`. Shared by the dev tooling, the tests and the sealed box. */
export async function migrateDatabase(db: ShopperDatabase, folder: string) {
  // Drizzle's global deployment journal is infrastructure, outside the tenant schema.
  // Precreate it to replace its default serial primary key with PG18 UUIDv7.
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id uuid PRIMARY KEY DEFAULT uuidv7(), hash text NOT NULL, created_at bigint
  )`);
  await migrate(db, { migrationsFolder: folder });
}
