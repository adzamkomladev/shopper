import { buildInfo } from "@shopper/config";
import type { Queue } from "@shopper/ports";
import type { ApiPrincipal } from "../../types";

/** Who a back-office command runs as; `branchId` is the branch a portal write is about, for its audit row. */
export const commandContext = (principal: ApiPrincipal, queue?: Queue, branchId?: unknown) => ({
  orgId: principal.orgId,
  actorId: principal.userId,
  role: principal.roleName,
  deviceId: principal.deviceId,
  branchId: principal.branchId ?? (typeof branchId === "string" ? branchId : undefined),
  appVersion: buildInfo.version,
  queue,
});
