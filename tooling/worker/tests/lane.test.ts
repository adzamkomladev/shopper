import { env, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { test } from "vitest";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { cloudflareDatabase, cloudflareLane } from "@shopper/adapters-cf";
import type { FiscalLane } from "@shopper/adapters-cf/coordination";
import { laneConformance } from "@shopper/conformance";
import { buildInfo } from "@shopper/config";
import { provisionOrg } from "@shopper/core";
import { provisionPendingSale } from "@shopper/tests/support/till/pending/sale";
import { seedFiscalDocs } from "@shopper/tests/support/fiscal/docs";

const bindings = env as unknown as {
  HYPERDRIVE: Hyperdrive;
  FISCAL_LANE: DurableObjectNamespace<FiscalLane>;
  SHOPPER_SDC_URL: string;
};
const withDatabase = async <T>(run: (db: schema.ShopperDatabase) => Promise<T>) => {
  const connection = await cloudflareDatabase(bindings.HYPERDRIVE.connectionString);
  try {
    return await run(connection.db);
  } finally {
    await connection.close();
  }
};
// The SDC fake runs in the Vitest process; the Worker steers it over its test routes.
const control = (body: object) =>
  fetch(`${bindings.SHOPPER_SDC_URL}/test/control`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then(() => undefined);

laneConformance("Cloudflare FiscalLane in workerd", test, async () => {
  await control({ action: "reset" });
  const orgId = v7();
  const context = { orgId, appVersion: buildInfo.version };
  const { storeId, pending } = await withDatabase(async (db) => {
    await provisionOrg(db, context, {
      name: "Lane conformance",
      metadata: {
        schemaVersion: buildInfo.schemaVersion,
        syncProtocol: buildInfo.syncProtocol,
        archiveFormat: buildInfo.archiveFormat,
      },
    });
    const [store] = await db.insert(schema.store).values({ orgId, name: "Lane store" }).returning();
    const sale = await provisionPendingSale(db, context, store!.id, orgId, buildInfo.version);
    return { storeId: store!.id, pending: sale };
  });
  const stub = (store: string) => bindings.FISCAL_LANE.getByName(`${orgId}/${store}`);
  const waiting = (store: string) =>
    runInDurableObject(
      stub(store),
      async (_instance, state) =>
        state.storage.sql.exec<{ n: number }>("SELECT count(*) AS n FROM queue").one().n,
    );
  return {
    lane: cloudflareLane(bindings.FISCAL_LANE),
    orgId,
    storeId,
    otherStoreId: pending.otherStoreId,
    docs: (store, prefix, count) =>
      withDatabase((db) =>
        seedFiscalDocs(db, context, {
          baseLocalId: pending.localId,
          storeId: store,
          prefix,
          count,
        }),
      ),
    sdc: {
      failNext: (count) => control({ action: "failNext", count }),
      down: () => control({ action: "down" }),
      up: () => control({ action: "up" }),
      arrivals: async () =>
        (
          (await (await fetch(`${bindings.SHOPPER_SDC_URL}/test/arrivals`)).json()) as {
            invoiceNumber: string;
          }[]
        ).map((arrival) => arrival.invoiceNumber),
    },
    async drain(store, rounds = Number.POSITIVE_INFINITY) {
      // Forcing the alarm skips the backoff wait. A real alarm may already be running: wait for it first.
      for (let round = 0; round < rounds; round++) {
        await stub(store).settled();
        if (!(await waiting(store))) return;
        await runDurableObjectAlarm(stub(store));
      }
      await stub(store).settled();
    },
    status: (docId) =>
      withDatabase(async (db) => {
        const [doc] = await db
          .select()
          .from(schema.fiscalDoc)
          .where(eq(schema.fiscalDoc.id, docId));
        return doc!.status;
      }),
    // The queue is the object's durable storage, so a new stub over it is the restarted lane.
    async reopen() {},
    async close() {},
  };
});
