import type { ShopperDatabase } from "@shopper/db-pg";
import type { Realtime } from "@shopper/ports";

export type ApprovalDeps = {
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  realtime: Realtime;
  appVersion: string;
  now?: () => number;
  /** Overrides the wait until the request's expiry (tests). */
  timeoutMs?: number;
};
