import { DurableObject } from "cloudflare:workers";
import { buildInfo } from "@shopper/config";
import { releaseExpiredHolds } from "@shopper/core/orders";
import { scopedKey, type StockHolds } from "@shopper/ports";
import { cloudflareDatabase } from "./database";

/** How long a failed release waits before it tries again. */
const retryMs = 60_000;

/**
 * One branch's release of expired online-order holds. PostgreSQL keeps the holds; this object only remembers whose
 * they are and keeps one alarm at the earliest expiry, re-armed after each release.
 */
export class StockHold extends DurableObject<{ HYPERDRIVE: Hyperdrive }> {
  constructor(ctx: DurableObjectState, env: { HYPERDRIVE: Hyperdrive }) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS scope (id INTEGER PRIMARY KEY CHECK (id = 1), org_id TEXT NOT NULL, branch_id TEXT NOT NULL)",
    );
  }
  async watch(orgId: string, branchId: string, expiresAt: number) {
    scopedKey(orgId, branchId);
    this.ctx.storage.sql.exec(
      "INSERT INTO scope (id, org_id, branch_id) VALUES (1, ?, ?) ON CONFLICT (id) DO NOTHING",
      orgId,
      branchId,
    );
    const armed = await this.ctx.storage.getAlarm();
    if (armed === null || expiresAt < armed) await this.ctx.storage.setAlarm(expiresAt);
  }
  async alarm() {
    const [scope] = this.ctx.storage.sql
      .exec<{ org_id: string; branch_id: string }>("SELECT org_id, branch_id FROM scope")
      .toArray();
    if (!scope) return;
    let connection: Awaited<ReturnType<typeof cloudflareDatabase>> | undefined;
    try {
      connection = await cloudflareDatabase(this.env.HYPERDRIVE.connectionString);
      const { next } = await releaseExpiredHolds(
        connection.db,
        { orgId: scope.org_id, appVersion: buildInfo.version },
        { branchId: scope.branch_id, now: new Date() },
      );
      if (next) await this.ctx.storage.setAlarm(new Date(next).getTime());
    } catch (error) {
      // PostgreSQL could not be reached: the holds stay put and the alarm comes back, never lost.
      console.error({ event: "stock.hold_release_failed", orgId: scope.org_id, error });
      await this.ctx.storage.setAlarm(Date.now() + retryMs);
    } finally {
      await connection?.close();
    }
  }
}

export function cloudflareStockHolds(binding: DurableObjectNamespace<StockHold>): StockHolds {
  return {
    watch: (orgId, branchId, expiresAt) =>
      binding.getByName(`${orgId}/${branchId}`).watch(orgId, branchId, expiresAt.getTime()),
  };
}
