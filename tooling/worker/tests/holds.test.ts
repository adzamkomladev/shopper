import { env, runDurableObjectAlarm } from "cloudflare:test";
import { test } from "vite-plus/test";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { cloudflareDatabase, cloudflareStockHolds } from "@shopper/adapters-cf";
import type { StockHold } from "@shopper/adapters-cf/coordination";
import { stockHoldConformance } from "@shopper/conformance";
import { buildInfo } from "@shopper/config";
import { provisionOrg } from "@shopper/core";
import { holdWorld } from "@shopper/tests/support/orders/holds";

const bindings = env as unknown as {
  HYPERDRIVE: Hyperdrive;
  STOCK_HOLD: DurableObjectNamespace<StockHold>;
};
const withDatabase = async <T>(run: (db: schema.ShopperDatabase) => Promise<T>) => {
  const connection = await cloudflareDatabase(bindings.HYPERDRIVE.connectionString);
  try {
    return await run(connection.db);
  } finally {
    await connection.close();
  }
};

// The same cases as tests/integration/ports/holds.test.ts, against the Durable Object and its alarm.
stockHoldConformance("Cloudflare StockHold in workerd", test, async () => {
  const orgId = v7();
  const world = await withDatabase(async (db) => {
    await provisionOrg(
      db,
      { orgId, appVersion: buildInfo.version },
      {
        name: "Hold conformance",
        metadata: {
          schemaVersion: buildInfo.schemaVersion,
          syncProtocol: buildInfo.syncProtocol,
          archiveFormat: buildInfo.archiveFormat,
        },
      },
    );
    return holdWorld(db, orgId);
  });
  return {
    holds: cloudflareStockHolds(bindings.STOCK_HOLD),
    orgId,
    branchId: world.branchId,
    otherBranchId: world.otherBranchId,
    seed: (branchId, ms) => withDatabase((db) => world.seed(db, branchId, ms)),
    released: (orderId) => withDatabase((db) => world.released(db, orderId)),
    // Runs the armed alarm now; a real alarm that already ran leaves nothing armed, which is the same outcome.
    fire: async (branchId) =>
      void (await runDurableObjectAlarm(bindings.STOCK_HOLD.getByName(`${orgId}/${branchId}`))),
    close: async () => {},
  };
});
