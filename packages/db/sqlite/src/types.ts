import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

export type TillSqlite = BaseSQLiteDatabase<"async", unknown>;
export interface TillDatabase {
  read<T>(fn: (db: TillSqlite) => Promise<T>): Promise<T>;
  transaction<T>(fn: (tx: TillSqlite) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
