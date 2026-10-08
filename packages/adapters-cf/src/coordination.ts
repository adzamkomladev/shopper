import { DurableObject } from "cloudflare:workers";
import { nextStoreSequence } from "@shopper/core";
import { buildInfo } from "@shopper/config";
import { scopedKey } from "@shopper/ports";
import { cloudflareDatabase } from "./database";

// PG is the durable record. The DO provides one hot coordination address per store;
// it keeps no second cursor that could disagree with a committed PG transaction.
export class StoreSequencer extends DurableObject<{ HYPERDRIVE: Hyperdrive }> {
  async next(orgId: string, storeId: string, floor = "0"): Promise<string> {
    scopedKey(orgId, storeId);
    if (!/^\d+$/.test(floor)) throw new RangeError("Invalid sequence floor");
    const connection = await cloudflareDatabase(this.env.HYPERDRIVE.connectionString);
    try {
      const sequence = await nextStoreSequence(
        connection.db,
        { orgId, appVersion: buildInfo.version },
        storeId,
        BigInt(floor),
      );
      return sequence.toString();
    } finally {
      await connection.close();
    }
  }
}
