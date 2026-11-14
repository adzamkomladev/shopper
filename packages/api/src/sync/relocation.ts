import { buildInfo } from "@shopper/config";
import type { cloudMove, ShopperDatabase } from "@shopper/db-pg";
import { deliverRelocation } from "@shopper/export";

/**
 * A moved box's handshake: no receipt blocks (numbers it issued now would be unknown to the cloud), and once the
 * cloud has taken the shop, this register's signed relocation. The first hand-over is recorded for the move screen.
 */
export async function relocationHandshake(
  db: ShopperDatabase,
  move: typeof cloudMove.$inferSelect,
  principal: { orgId: string; deviceId: string; branchId: string },
  data: { requestId: string; protocol: number; appVersion: string },
) {
  const relocation = move.relocations[principal.deviceId];
  if (relocation && !relocation.deliveredAt)
    await deliverRelocation(
      db,
      {
        orgId: principal.orgId,
        deviceId: principal.deviceId,
        branchId: principal.branchId,
        appVersion: data.appVersion,
      },
      { moveId: move.id, deviceId: principal.deviceId },
    );
  return {
    requestId: data.requestId,
    appVersion: buildInfo.version,
    protocol: data.protocol,
    serverTime: new Date().toISOString(),
    ...(relocation ? { relocation: JSON.parse(relocation.message) as unknown } : {}),
  };
}
