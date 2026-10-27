import { abortAllDurableObjects, env } from "cloudflare:test";
import { expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { cloudflareDatabase, cloudflareSequencer } from "@shopper/adapters-cf";
import type { StoreSequencer } from "@shopper/adapters-cf/coordination";
import { buildInfo } from "@shopper/config";
import { provisionOrg } from "@shopper/core";
import { provisionPendingSale } from "@shopper/tests/support/till/pending/sale";

const bindings = env as unknown as {
  HYPERDRIVE: Hyperdrive;
  STORE_SEQUENCER: DurableObjectNamespace<StoreSequencer>;
};
const withDatabase = async <T>(run: (db: schema.ShopperDatabase) => Promise<T>) => {
  const connection = await cloudflareDatabase(bindings.HYPERDRIVE.connectionString);
  try {
    return await run(connection.db);
  } finally {
    await connection.close();
  }
};

test("restarting the StoreSequencer mid-stream never repeats a sequence or reassigns a sale", async () => {
  const orgId = v7();
  const context = { orgId, appVersion: buildInfo.version };
  const { storeId, sales } = await withDatabase(async (db) => {
    await provisionOrg(db, context, {
      name: "Sequencer restart",
      metadata: {
        schemaVersion: buildInfo.schemaVersion,
        syncProtocol: buildInfo.syncProtocol,
        archiveFormat: buildInfo.archiveFormat,
      },
    });
    const [store] = await db.insert(schema.store).values({ orgId, name: "Restart" }).returning();
    const first = await provisionPendingSale(db, context, store!.id, v7(), buildInfo.version);
    // Five more unsequenced sales from the same register: copies of the first under new identities.
    const [row] = await db.select().from(schema.sale).where(eq(schema.sale.localId, first.localId));
    const clones = Array.from({ length: 5 }, (_, index) => ({
      ...row!,
      id: v7(),
      localId: v7(),
      receiptNumber: `${row!.receiptNumber}-R${index}`,
    }));
    await db.insert(schema.sale).values(clones);
    const pending = [first, ...clones.map((clone) => ({ ...first, localId: clone.localId }))];
    return { storeId: store!.id, sales: pending };
  });
  const sequencer = cloudflareSequencer(bindings.STORE_SEQUENCER);
  // A caller whose reply died with the object retries, as the push route's client does.
  const retrying = async <T>(call: () => Promise<T>): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await call();
      } catch (error) {
        if (attempt >= 5) throw error;
      }
    }
  };
  const lastSeq = () =>
    withDatabase(async (db) => {
      const [row] = await db.select().from(schema.store).where(eq(schema.store.id, storeId));
      return row!.lastSeq;
    });
  const assign = (sale: (typeof sales)[number]) =>
    retrying(() => sequencer.assignSale(orgId, storeId, sale.deviceId, sale.localId));
  // Half the sales are numbered before the restart; the rest are in flight when it happens.
  const early = await Promise.all(sales.slice(0, 3).map(assign));
  const before = await lastSeq();
  const nexts = Array.from({ length: 30 }, () => retrying(() => sequencer.next(orgId, storeId)));
  const late = sales.slice(3).map(assign);
  // Abort only once the in-flight stream has visibly moved the store's counter.
  while ((await lastSeq()) === before) await new Promise((resolve) => setTimeout(resolve, 2));
  await abortAllDurableObjects();
  await new Promise((resolve) => setTimeout(resolve, 5));
  await abortAllDurableObjects();
  const values = await Promise.all(nexts);
  const saleSequences = [...early, ...(await Promise.all(late))];

  const all = [...values, ...saleSequences];
  expect(new Set(all).size).toBe(all.length);
  // Each sale keeps the one sequence it was given, however often it is asked again after the restart.
  for (const [index, sale] of sales.entries()) {
    expect(await sequencer.assignSale(orgId, storeId, sale.deviceId, sale.localId)).toBe(
      saleSequences[index],
    );
  }
  const audits = await withDatabase((db) =>
    db
      .select({ entityId: schema.auditLog.entityId })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.command, "sale.assign-sequence")),
  );
  for (const sale of sales)
    expect(audits.filter((audit) => audit.entityId === sale.localId)).toHaveLength(1);
  const last = await lastSeq();
  const highest = all.reduce((max, value) => (value > max ? value : max));
  expect(last >= highest).toBe(true);
  // The next number after the restart continues above everything handed out before it.
  expect((await sequencer.next(orgId, storeId)) > last).toBe(true);
}, 120_000);
