import type { ShopperDatabase } from "@shopper/db-pg";

export type UpdateVerdict =
  | { ok: true }
  | {
      ok: false;
      reason: "kind" | "current" | "older" | "licence" | "maintenance";
      message: string;
    };

export interface BoxUpdateDeps {
  // Each step opens its own connection: workflows outlive the request that started them.
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  appVersion: string;
  /** Backs up and unpacks the bundle into the spare slot, or resolves undefined when this schedule was cancelled or replaced. */
  apply(file: string, instanceId: string): Promise<{ version: string } | undefined>;
  /** Asks the box's root helper to switch to the staged slot. The box restarts, so this follows the audit entry. */
  handoff(file: string, version: string): Promise<void>;
}
