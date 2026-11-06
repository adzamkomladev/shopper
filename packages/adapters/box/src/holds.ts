import type { ShopperDatabase } from "@shopper/db-pg";
import { heldBranches, releaseExpiredHolds } from "@shopper/core/orders";
import type { StockHolds } from "@shopper/ports";

type Armed = { at: number; timer: ReturnType<typeof setTimeout> };

// shortcut: in-process timers, re-armed from PostgreSQL by `rearm` at boot; Rivet actors replace them on Day 36.
/** The box twin of the StockHold Durable Object: one timer per branch at its earliest hold expiry. */
export function boxStockHolds(deps: { db: ShopperDatabase; appVersion: string }) {
  const armed = new Map<string, Armed>();
  const running = new Set<Promise<void>>();
  const arm = (orgId: string, branchId: string, at: number) => {
    const key = `${orgId}/${branchId}`;
    const current = armed.get(key);
    if (current && current.at <= at) return;
    if (current) clearTimeout(current.timer);
    const timer = setTimeout(
      () => {
        armed.delete(key);
        const release = releaseExpiredHolds(
          deps.db,
          { orgId, appVersion: deps.appVersion },
          { branchId, now: new Date() },
        )
          .then(({ next }) => {
            if (next) arm(orgId, branchId, new Date(next).getTime());
          })
          .catch((error: unknown) => {
            // PostgreSQL could not be reached: the holds stay put and the timer comes back.
            console.error({ event: "stock.hold_release_failed", orgId, error });
            arm(orgId, branchId, Date.now() + 60_000);
          })
          .finally(() => running.delete(release));
        running.add(release);
      },
      Math.max(0, at - Date.now()),
    );
    armed.set(key, { at, timer });
  };
  const holds: StockHolds = {
    watch: async (orgId, branchId, expiresAt) => arm(orgId, branchId, expiresAt.getTime()),
  };
  return {
    holds,
    /** At boot: arms every branch that still holds stock, so a restart never strands a hold. */
    async rearm() {
      for (const row of await heldBranches(deps.db))
        arm(row.orgId, row.branchId, row.next.getTime());
    },
    /** Resolves once every release in progress has finished; tests and shutdown wait on it. */
    async settled() {
      while (running.size) await Promise.all(running);
    },
    stop() {
      for (const entry of armed.values()) clearTimeout(entry.timer);
      armed.clear();
    },
  };
}
