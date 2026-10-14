import type { HostStatus } from "@shopper/sync/bridge";
import type { HostConnection } from "./types";

/** Sync now is offered only on a live host that is not already syncing and can still upload. */
export function canSyncNow(host: HostConnection, status: HostStatus | null) {
  return (
    host === "connected" &&
    status !== null &&
    !status.syncing &&
    status.server !== "revoked" &&
    status.server !== "incompatible"
  );
}
