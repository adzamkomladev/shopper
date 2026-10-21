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

/** A till writes to its own branch, whatever the body says. The command validates the shape. */
export const forceBranch = <T>(principal: ApiPrincipal, raw: unknown) =>
  (principal.deviceId && raw && typeof raw === "object"
    ? { ...raw, branchId: principal.branchId }
    : raw) as T;

/** A till's own branch, or undefined for a back-office member who may see every branch. */
export const onlyBranch = (principal: ApiPrincipal) =>
  principal.deviceId ? principal.branchId : undefined;
