import type { Sequencer } from "@shopper/ports";
import { assignSaleSequence, nextStoreSequence } from "@shopper/core";
import { buildInfo } from "@shopper/config";
import type { ShopperDatabase } from "@shopper/db-pg";

export function boxSequencer(db: ShopperDatabase): Sequencer {
  return {
    assignSale: (orgId, storeId, deviceId, localId) =>
      assignSaleSequence(db, { orgId, appVersion: buildInfo.version }, storeId, deviceId, localId),
    next: (orgId, storeId, floor) =>
      nextStoreSequence(db, { orgId, appVersion: buildInfo.version }, storeId, floor),
  };
}
