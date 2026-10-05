import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
export * from "./schema";
export type ShopperDatabase = NodePgDatabase<typeof schema>;
export type ShopperTransaction = Parameters<Parameters<ShopperDatabase["transaction"]>[0]>[0];
