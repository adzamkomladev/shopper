import { buildInfo } from "@shopper/config";
import type { ApiPrincipal } from "../../types";

/** Who a back-office command runs as. */
export const commandContext = (principal: ApiPrincipal) => ({
  orgId: principal.orgId,
  actorId: principal.userId,
  role: principal.roleName,
  deviceId: principal.deviceId,
  branchId: principal.branchId,
  appVersion: buildInfo.version,
});
