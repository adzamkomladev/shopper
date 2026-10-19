import { buildInfo } from "@shopper/config";
import type { HostConfiguration } from "./config";

/** The audit context of the signed-in cashier on this register. */
export function auditContext(config: HostConfiguration) {
  const { orgId, deviceId, branchId } = config.identity;
  return {
    orgId,
    deviceId,
    branchId,
    actorId: config.session?.userId,
    role: config.session?.roleName,
    appVersion: buildInfo.version,
  };
}
