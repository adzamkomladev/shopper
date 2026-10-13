import { openTillDatabase } from "@shopper/adapters-box";
import { defineCommand } from "@shopper/audit/sqlite";
export type { CommandContext } from "@shopper/audit";
import type { TillDatabase, TillSqlite } from "@shopper/db-sqlite";

export { openTillDatabase, defineCommand as sqliteDefineCommand };
export type { TillDatabase, TillSqlite };
