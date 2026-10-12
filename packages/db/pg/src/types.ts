import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "./schemas";

export type ShopperDatabase = NodePgDatabase<typeof schema>;
export type ShopperTransaction = Parameters<Parameters<ShopperDatabase["transaction"]>[0]>[0];
