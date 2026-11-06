import type { ShopperDatabase } from "@shopper/db-pg";

/** What the online order workflow needs from its runtime shell. */
export type OrderFlowDeps = {
  withDatabase: <T>(run: (db: ShopperDatabase) => Promise<T>) => Promise<T>;
  appVersion: string;
  /** How long the store has to accept a paid order; a day unless a test shortens it. */
  acceptWithinMs?: number;
};
