import { fileURLToPath } from "node:url";
import { migrateDatabase as migrate } from "../../packages/db/pg/src/migrate";
import type { ShopperDatabase } from "../../packages/db/pg/src/index";

export const migrateDatabase = (db: ShopperDatabase) =>
  migrate(db, fileURLToPath(new URL("../../packages/db/pg/migrations", import.meta.url)));
