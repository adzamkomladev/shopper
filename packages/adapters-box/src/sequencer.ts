import type { Sequencer } from "@shopper/ports";
import { nextStoreSequence } from "@shopper/core";
import { buildInfo } from "@shopper/config";
import type { ShopperDatabase } from "@shopper/db-pg";

export function boxSequencer(db: ShopperDatabase): Sequencer {
  return {
    next: (orgId, storeId, floor) =>
      nextStoreSequence(db, { orgId, appVersion: buildInfo.version }, storeId, floor),
  };
}
