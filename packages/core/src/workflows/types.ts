import { type ShopperDatabase } from "@shopper/db-pg";
import { type Queue, type Realtime } from "@shopper/ports";

export interface PriceChangeDeps {
  // Each step opens its own connection: workflows outlive the request that started them.
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  realtime: Realtime;
  appVersion: string;
}

export interface AccountFlowDeps {
  // Each step opens its own connection: workflows outlive the request that started them.
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  appVersion: string;
  /** Carries tier notices to the notification consumer. */
  queue?: Queue;
}
