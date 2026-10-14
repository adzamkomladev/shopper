import { scopedKey } from "@shopper/ports";
import type { StoreHub } from "./coordination";

export function cloudflareLive(binding: DurableObjectNamespace<StoreHub>) {
  return async (
    _request: Request,
    principal: { orgId: string; storeId: string; deviceId: string },
    cursor: string,
  ) => {
    const query = new URLSearchParams({ device: principal.deviceId, cursor, nudges: "1" });
    return binding
      .getByName(scopedKey(principal.orgId, principal.storeId))
      .fetch(`https://store-hub/?${query}`, {
        headers: { Upgrade: "websocket" },
      });
  };
}
