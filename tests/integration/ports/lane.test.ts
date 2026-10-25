// The FiscalLane conformance cases against the box twin, with the SDC fake in this process. Workers run the same
// cases against the Durable Object in tooling/worker/tests/lane.test.ts.
import { afterAll, beforeAll, test } from "vite-plus/test";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
import { boxLane } from "@shopper/adapters-box";
import { createSdc } from "@shopper/core/fiscal";
import { laneConformance } from "@shopper/conformance";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { startSdcFake } from "../../../tooling/sdc/server";
import { postgresFixture } from "../../fixtures/postgres";
import { provisionPendingSale } from "../../support/till/pending/sale";
import { seedFiscalDocs } from "../../support/fiscal/docs";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let db: schema.ShopperDatabase;
const fake = await startSdcFake();
const sdc = createSdc({ url: fake.url, apiKey: fake.apiKey });
beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  await migrateDatabase(db);
});
afterAll(async () => {
  await fake.stop();
  await pool?.end();
  await fixture?.close();
});

const createStore = async (orgId: string, appVersion: string) => {
  const [row] = await db.insert(schema.store).values({ orgId, name: "Lane store" }).returning();
  return { id: row!.id, appVersion };
};

laneConformance("box lane", test, async () => {
  fake.reset();
  const ctx = provisioningContext();
  await provisionOrg(db, ctx, { name: "Lane conformance" });
  const store = await createStore(ctx.orgId, ctx.appVersion);
  const pending = await provisionPendingSale(db, ctx, store.id, ctx.orgId, ctx.appVersion);
  let lane = boxLane({ db, sdc, appVersion: ctx.appVersion });
  return {
    get lane() {
      return lane;
    },
    orgId: ctx.orgId,
    storeId: store.id,
    otherStoreId: pending.otherStoreId,
    docs: (storeId, prefix, count) =>
      seedFiscalDocs(db, ctx, { baseLocalId: pending.localId, storeId, prefix, count }),
    sdc: {
      failNext: async (count) => fake.failNext(count),
      down: async () => fake.down(),
      up: async () => fake.up(),
      arrivals: async () => fake.arrivals.map((arrival) => arrival.invoiceNumber),
    },
    async drain(storeId, rounds = Number.POSITIVE_INFINITY) {
      for (let round = 0; round < rounds && lane.waiting(ctx.orgId, storeId); round++)
        await lane.wake(ctx.orgId, storeId);
    },
    async status(docId) {
      const [doc] = await db.select().from(schema.fiscalDoc).where(eq(schema.fiscalDoc.id, docId));
      return doc!.status;
    },
    async reopen() {
      lane.close();
      lane = boxLane({ db, sdc, appVersion: ctx.appVersion });
      await lane.relaunch();
    },
    close: async () => lane.close(),
  };
});
