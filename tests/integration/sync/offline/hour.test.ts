import { afterEach, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { localSale, outbox, reference } from "@shopper/db-sqlite";
import { createPullWorker, createPushWorker } from "@shopper/sync";
import { recordLocalSale } from "@shopper/core/till";
import { createProduct, setPrice, updateProduct } from "@shopper/core/catalogue";
import {
  appVersion,
  blobs,
  context,
  databases,
  deviceId,
  deviceToken,
  devices,
  hostConfiguration,
  routeFactory,
  sequencer,
  syncProtocol,
} from "../../../support/till/server";
import { serveHono, type HttpClient } from "../../../support/till/http";
import { head, pullHeaders, tillCursor, tillFile } from "../../../support/till/pull";
import { config, ids } from "../../../support/till/sales";

let till: Awaited<ReturnType<typeof tillFile>> | undefined;
let server: HttpClient | undefined;
let push: ReturnType<typeof createPushWorker> | undefined;
let pull: ReturnType<typeof createPullWorker> | undefined;
afterEach(async () => {
  await push?.stop();
  await pull?.stop();
  await server?.close();
  await till?.close();
});

test("a till offline for one hour converges exactly after exhausting its receipt blocks", async () => {
  let clock = Date.now();
  const options = {
    database: databases().db,
    devices,
    sequencer,
    syncProtocol,
    blobs,
    now: () => clock,
  };
  server = await serveHono(routeFactory(options));
  till = await tillFile();
  const host = await hostConfiguration("unused", [], server.url, { freshSession: true });
  if (!host.session) throw new Error("Gate requires a cashier session");
  const workerOptions = {
    database: till.database,
    config: {
      orgId: context.orgId,
      storeId: config.storeId,
      deviceId,
      deviceToken,
      appVersion,
      protocol: syncProtocol,
      upstream: server.url,
    },
    now: () => clock,
    random: () => 0,
  };
  push = createPushWorker(workerOptions);
  pull = createPullWorker(workerOptions);
  await push.trigger();
  await pull.trigger();
  expect(pull.getStatus().state).toBe("idle");
  const before = await till.database.read((tx) => tx.select().from(reference));
  const owner = { ...context, reason: "Offline gate" };
  // No worker runs during the injected hour; only the till's local sale command is available.
  const events = [];
  for (let index = 0; index < 2_001; index++) {
    clock += 1_000;
    events.push(
      await recordLocalSale(
        till.database,
        {
          ...config,
          deviceId,
          now: () => new Date(clock),
        },
        host.session,
        { lines: [{ productId: ids.product, quantityThousandths: 1_000 }] },
      ),
    );
    if (index === 1_000) {
      await updateProduct(databases().db, owner, {
        id: ids.product,
        data: { name: "Milk after offline change" },
      });
      await setPrice(databases().db, owner, {
        productId: ids.product,
        data: {
          branchId: ids.branch,
          amount: 15_000,
          validFrom: new Date(clock).toISOString(),
        },
      });
      await createProduct(databases().db, owner, {
        sku: "GATE-NEW",
        name: "New while offline",
        baseUnit: "each",
        taxClass: "standard",
      });
    }
  }
  clock += 3_600_000 - 2_001_000;
  expect(await till.database.read((tx) => tx.select().from(reference))).toEqual(before);
  expect(events[0]!.sale.receiptNumber).toMatch(/-000001$/);
  expect(events[1_999]!.sale.receiptNumber).toMatch(/-002000$/);
  expect(events[2_000]!.sale).toMatchObject({ receiptOverflow: true });
  expect(events[2_000]!.sale.receiptNumber).toMatch(/-X000001$/);
  await push.trigger();
  await pull.trigger();
  expect(push.getStatus()).toMatchObject({ server: "online", lastError: null });
  const waiting = await till.database.read((tx) => tx.select().from(outbox));
  expect(waiting.map((row) => row.blockedReason).filter(Boolean)).toEqual([]);
  expect(waiting).toEqual([]);
  const stored = await databases()
    .db.select()
    .from(schema.sale)
    .where(and(eq(schema.sale.orgId, context.orgId), eq(schema.sale.deviceId, deviceId)));
  const local = await till.database.read((tx) => tx.select().from(localSale));
  expect(stored).toHaveLength(2_001);
  expect(local).toHaveLength(stored.length);
  const byId = new Map(stored.map((sale) => [sale.localId, sale]));
  for (const sale of local) {
    const saved = byId.get(sale.localId);
    expect(saved?.payload).toEqual(sale.payload);
    expect(String(saved?.storeSequence)).toBe(sale.storeSequence);
    expect(saved?.occurredAt.toISOString()).toBe(sale.occurredAt);
    expect(saved?.occurredAt.toISOString()).toBe(
      (sale.payload as { deviceTime: string }).deviceTime,
    );
    expect(saved?.contentHash).toBe(sale.contentHash);
  }
  expect(new Set(stored.map((sale) => sale.receiptNumber)).size).toBe(2_001);
  expect(new Set(stored.map((sale) => String(sale.storeSequence))).size).toBe(2_001);
  const snapshot = await (
    await server.request("/sync/snapshot", { headers: pullHeaders() })
  ).json();
  const refs = await till.database.read((tx) => tx.select().from(reference));
  const expected = [
    ...snapshot.reference.products,
    ...snapshot.reference.prices,
    ...snapshot.reference.taxRules,
    { id: snapshot.orgId, cashRounding: snapshot.reference.cashRounding ?? "10p" },
  ];
  expect(refs.map((row) => row.payload).sort(byReferenceId)).toEqual(expected.sort(byReferenceId));
  expect(await tillCursor(till.database)).toBe(String(await head()));
  const cursor = await tillCursor(till.database);
  await push.trigger();
  await pull.trigger();
  expect(await tillCursor(till.database)).toBe(cursor);
  expect(await databases().db.select().from(schema.sale)).toHaveLength(2_001);
}, 600_000);

function byReferenceId(a: unknown, b: unknown) {
  return (a as { id: string }).id.localeCompare((b as { id: string }).id);
}
