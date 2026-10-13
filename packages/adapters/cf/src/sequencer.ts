import type { Sequencer } from "@shopper/ports";
import type { StoreSequencer } from "./coordination";

export function cloudflareSequencer(binding: DurableObjectNamespace<StoreSequencer>): Sequencer {
  return {
    async assignSale(orgId, storeId, deviceId, localId) {
      return BigInt(
        await binding
          .getByName(`${orgId}/${storeId}`)
          .assignSale(orgId, storeId, deviceId, localId),
      );
    },
    async next(orgId, storeId, floor = 0n) {
      return BigInt(
        await binding.getByName(`${orgId}/${storeId}`).next(orgId, storeId, floor.toString()),
      );
    },
  };
}
