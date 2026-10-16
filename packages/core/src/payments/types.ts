import type { ShopperDatabase } from "@shopper/db-pg";
import type { Realtime } from "@shopper/ports";
import type { createPaystack } from "./paystack/client";

export type MomoDeps = {
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  realtime: Realtime;
  paystack: ReturnType<typeof createPaystack>;
  appVersion: string;
  now?: () => number;
  timeoutMs?: number;
};
