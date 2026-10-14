import { type ShopperDatabase } from "@shopper/db-pg";
import { type Realtime } from "@shopper/ports";

export interface PriceChangeDeps {
  // Each step opens its own connection: workflows outlive the request that started them.
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  realtime: Realtime;
  appVersion: string;
}
