import type { payment, ShopperDatabase } from "@shopper/db-pg";
import type { Realtime } from "@shopper/ports";
import type { createHubtel } from "./hubtel/client";
import type { createPaystack } from "./paystack/client";

export type MomoDeps = {
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  realtime: Realtime;
  paystack: ReturnType<typeof createPaystack>;
  /** Collects for orgs whose MoMo provider is Hubtel; without it their charges fail with a reason. */
  hubtel?: ReturnType<typeof createHubtel>;
  appVersion: string;
  now?: () => number;
  timeoutMs?: number;
};

export type MomoUpdate = {
  reference: string;
  status: typeof payment.$inferSelect.status;
  providerReference?: string;
  message?: string;
};
