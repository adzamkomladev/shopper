import { verifyPin } from "@shopper/auth/devices";
import { buildInfo } from "@shopper/config";
import { approve, hostTime, TillError, unlockStaff } from "@shopper/core/till";
import type { TillDatabase } from "@shopper/db-sqlite";
import type { HostConfiguration } from "../config";

/**
 * A manager's PIN lifts a cashier's sign-in lock. When the server answers it checks the PIN and lifts its own lock;
 * only an unreachable server falls back to the register's copy of the approvers, as offline sign-in does.
 */
export function createUnlock(host: { database: TillDatabase; config: HostConfiguration }) {
  const { database, config } = host;
  const { identity } = config;

  /** True once the server unlocked, false when it could not be reached; a refusal throws. */
  async function forward(email: string, approverId: string, pin: string) {
    const response = await fetch(new URL("/cashiers/unlock", config.upstream), {
      method: "POST",
      headers: { "content-type": "application/json", "X-Shopper-Org": identity.orgId },
      body: JSON.stringify({
        deviceId: identity.deviceId,
        deviceToken: config.deviceToken,
        email,
        approverId,
        pin,
      }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);
    if (!response || response.status >= 500) return false;
    if (response.ok) return true;
    if (response.status === 429)
      throw new TillError("APPROVAL_LOCKED", "Too many attempts. Try again in 15 minutes.");
    if (response.status === 401) throw new TillError("APPROVAL_INVALID", "Wrong PIN");
    throw new TillError("APPROVAL_FORBIDDEN", "This person cannot unlock sign-in here");
  }

  return async function unlock(rawEmail: string, rawApproverId: string, pin: string) {
    const email = rawEmail.trim().toLowerCase();
    const approverId = rawApproverId.toLowerCase();
    const context = {
      orgId: identity.orgId,
      deviceId: identity.deviceId,
      branchId: identity.branchId,
      actorId: approverId,
      role: "approver",
      appVersion: buildInfo.version,
    };
    const online = await forward(email, approverId, pin);
    if (!online) {
      const at = await hostTime(database, identity, new Date());
      await approve(
        database,
        context,
        { approverId, pin, permission: "staff.unlock", at },
        verifyPin,
      );
    }
    await unlockStaff(database, context, { email, online });
  };
}
