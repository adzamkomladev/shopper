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
  /**
   * Backs up, stages and hands the bundle to the box's root helper; resolves once the handoff is made, or with
   * undefined when this schedule was cancelled or replaced meanwhile.
   */
  apply(file: string, instanceId: string): Promise<{ version: string } | undefined>;
}
