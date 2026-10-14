import type { ShopperDatabase, ShopperTransaction } from "@shopper/db-pg";

export type Queryable = ShopperDatabase | ShopperTransaction;

export type ManagementKind = "store" | "branch";
