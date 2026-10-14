import { v7 } from "uuid";
import type { Realtime } from "@shopper/ports";

export function publishStoreChanged(
  realtime: Realtime,
  orgId: string,
  storeId: string,
  sequence: string,
) {
  return realtime.publish(orgId, storeId, {
    id: v7(),
    orgId,
    v: 1,
    sequence,
    type: "store.changed",
    payload: { sequence },
  });
}
