import { buildInfo } from "@shopper/config";
import type { ShopperDatabase } from "@shopper/db-pg";
import { deliverBoxRelocation, deliverRelocation, leavingMove } from "@shopper/export";
import { activeCloudMove } from "../middleware/moved";

/**
 * The handshake of a register whose shop is leaving this server, or undefined for one that stays: a moved box (to the
 * cloud) and a leaving cloud org (onto its box) answer alike.
 */
export async function leavingHandshake(
  options: { database: ShopperDatabase; movable?: boolean; onPrem?: boolean },
  principal: { orgId: string; deviceId: string; branchId: string },
  data: { requestId: string; protocol: number; appVersion: string },
) {
  const context = { ...principal, appVersion: data.appVersion };
  const moved = options.movable ? await activeCloudMove(options.database) : undefined;
  if (moved)
    return relocationHandshake(
      moved.relocations,
      principal.deviceId,
      () =>
        deliverRelocation(options.database, context, {
          moveId: moved.id,
          deviceId: principal.deviceId,
        }),
      data,
    );
  const leaving = options.onPrem ? await leavingMove(options.database, principal.orgId) : undefined;
  if (!leaving) return undefined;
  return relocationHandshake(
    // Registers go to the box only once it has verified the shop it holds.
    leaving.status === "archived" ? leaving.relocations : {},
    principal.deviceId,
    () =>
      deliverBoxRelocation(options.database, context, {
        moveId: leaving.id,
        deviceId: principal.deviceId,
      }),
    data,
  );
}

/**
 * A leaving server's handshake (a box moved to the cloud, or a cloud shop moved onto its box): no receipt blocks
 * (numbers issued now would be unknown where the shop went), and once the shop has arrived, this register's signed
 * relocation. The first hand-over is recorded through `deliver`, for the move screen.
 */
async function relocationHandshake(
  relocations: Record<string, { message: string; deliveredAt: string | null }>,
  deviceId: string,
  deliver: () => Promise<unknown>,
  data: { requestId: string; protocol: number },
) {
  const relocation = relocations[deviceId];
  if (relocation && !relocation.deliveredAt) await deliver();
  return {
    requestId: data.requestId,
    appVersion: buildInfo.version,
    protocol: data.protocol,
    serverTime: new Date().toISOString(),
    ...(relocation ? { relocation: JSON.parse(relocation.message) as unknown } : {}),
  };
}
