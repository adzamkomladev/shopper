import { type ShopperDatabase } from "@shopper/db-pg";
import { type Blobs, type Queue, type Realtime } from "@shopper/ports";

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

export interface StatementFlowDeps {
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  appVersion: string;
  /** Carries the fanned-out statements to the notification consumer. */
  queue?: Queue;
}

export interface FiscalArchiveDeps {
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  appVersion: string;
  /** Where the hourly bundles are written: R2 in the cloud, RustFS or the filesystem on a box. */
  blobs: Blobs;
}
