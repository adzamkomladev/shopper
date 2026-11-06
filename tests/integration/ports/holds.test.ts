// The StockHold conformance cases against the box twin. Workers run the same cases against the Durable Object in
// tooling/worker/tests/holds.test.ts.
import { afterAll, beforeAll, test } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
import { boxStockHolds } from "@shopper/adapters-box";
import { stockHoldConformance } from "@shopper/conformance";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { postgresFixture } from "../../fixtures/postgres";
import { holdWorld } from "../../support/orders/holds";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let db: schema.ShopperDatabase;
beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  await migrateDatabase(db);
});
afterAll(async () => {
  await pool?.end();
  await fixture?.close();
});

stockHoldConformance("box StockHold", test, async () => {
  const context = provisioningContext();
  await provisionOrg(db, context, { name: "Hold conformance" });
  const world = await holdWorld(db, context.orgId);
  const box = boxStockHolds({ db, appVersion: context.appVersion });
  return {
    holds: box.holds,
    orgId: context.orgId,
    branchId: world.branchId,
    otherBranchId: world.otherBranchId,
    seed: (branchId, ms) => world.seed(db, branchId, ms),
    released: (orderId) => world.released(db, orderId),
    // The timer fires on its own once due; wait for whatever it started.
    fire: () => box.settled(),
    close: async () => box.stop(),
  };
});
