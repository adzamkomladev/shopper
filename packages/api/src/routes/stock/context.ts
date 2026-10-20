import { buildInfo } from "@shopper/config";
import type { Queue } from "@shopper/ports";
import type { ApiPrincipal } from "../../types";

/** Who a back-office command runs as. */
export const commandContext = (principal: ApiPrincipal, queue?: Queue) => ({
  orgId: principal.orgId,
  actorId: principal.userId,
  role: principal.roleName,
  deviceId: principal.deviceId,
  branchId: principal.branchId,
  appVersion: buildInfo.version,
  queue,
});
