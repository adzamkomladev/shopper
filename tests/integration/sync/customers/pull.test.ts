// Customers reach the till through the change feed (v4) and the snapshot, land in customer_lookup, and leave it when
// they are archived or merged. A snapshot rebuild keeps customers whose upload has not been accepted yet.
import { afterEach, beforeAll, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import { createPullWorker } from "@shopper/sync";
import {
  archiveCustomer,
  createCustomer,
  mergeCustomers,
  unarchiveCustomer,
  updateCustomer,
} from "@shopper/core/customers";
import { startCounter } from "../../../support/customers/till";
import { api, context, databases, deviceId } from "../../../support/till/server";
import { startHostUpstream } from "../../../support/till/host/upstream";
import {
  appendRows,
  pullOptions,
  startAtHead,
  tillCursor,
  tillFile,
} from "../../../support/till/pull";

const owner = { ...context, reason: "Customer pull test" };
const clock = { now: Date.parse("2026-10-14T09:00:00.000Z") };
const db = () => databases().db;
const create = async (name: string, phone: string) => {
  const id = v7();
  await createCustomer(db(), owner, { customer: { id, name, phone } });
  return id;
};
const lookup = (database: Awaited<ReturnType<typeof tillFile>>["database"]) =>
  database.read((tx) =>
    tx.all<{ customer_id: string; name: string; phone: string; version: number }>(
      sql`SELECT customer_id, name, phone, version FROM customer_lookup ORDER BY customer_id`,
    ),
  );
const ids = async (database: Parameters<typeof lookup>[0]) =>
  (await lookup(database)).map((row) => row.customer_id);

let till: Awaited<ReturnType<typeof tillFile>>;
let worker: ReturnType<typeof createPullWorker> | undefined;
let upstream: Awaited<ReturnType<typeof startHostUpstream>> | undefined;
const start = async () => {
  till = await tillFile();
  await startAtHead(till.database);
  worker = createPullWorker(pullOptions(till.database, api.url, clock));
};
beforeAll(() => appendRows([{}]));
afterEach(async () => {
  await worker?.stop();
  await upstream?.close();
  await till?.close();
  worker = upstream = undefined;
});

test("a portal-created customer reaches the lookup by pull and later edits replace the row", async () => {
  await start();
  const id = await create("Ama Mensah", "0241234567");
  await worker!.trigger();
  expect(await lookup(till.database)).toEqual([
    { customer_id: id, name: "Ama Mensah", phone: "0241234567", version: 1 },
  ]);
  const columns = await till.database.read((tx) =>
    tx.all<{ name: string }>(sql`SELECT name FROM pragma_table_info('customer_lookup')`),
  );
  expect(columns.map((c) => c.name)).not.toContain("email");

  await updateCustomer(db(), owner, {
    id,
    patch: { name: "Ama Owusu", email: "ama@example.test" },
  });
  await worker!.trigger();
  expect(await lookup(till.database)).toEqual([
    { customer_id: id, name: "Ama Owusu", phone: "0241234567", version: 2 },
  ]);
  expect(await tillCursor(till.database)).toBe(worker!.getStatus().cursor);
});

test("an archived customer drops out of the lookup after the next pull and returns when restored", async () => {
  await start();
  const id = await create("Archived Ama", "0241230001");
  await worker!.trigger();
  expect(await ids(till.database)).toEqual([id]);

  await archiveCustomer(db(), owner, { id, now: new Date() });
  await worker!.trigger();
  expect(await ids(till.database)).toEqual([]);

  await unarchiveCustomer(db(), owner, { id });
  await worker!.trigger();
  expect(await ids(till.database)).toEqual([id]);
});

test("a merged customer leaves the lookup and the winner stays", async () => {
  await start();
  const winnerId = await create("Winner Ama", "0241230002");
  const loserId = await create("Loser Ama", "0241230002");
  await worker!.trigger();
  expect(await ids(till.database)).toEqual([winnerId, loserId].sort());

  await mergeCustomers(db(), owner, { winnerId, loserId, now: new Date() });
  await worker!.trigger();
  expect(await ids(till.database)).toEqual([winnerId]);
});

test("v3 and v6 pages both apply, and a v7 row halts the pull as upgrade needed", async () => {
  await start();
  const row = (v: number) => {
    const id = v7();
    return {
      v,
      entityId: id,
      payload: {
        id,
        orgId: context.orgId,
        sku: id,
        name: `From a v${v} server`,
        baseUnit: "each",
        taxClass: "standard",
        archivedAt: null,
        barcodes: [],
      },
    };
  };
  const [older, current] = [row(3), row(6)];
  await appendRows([older, current]);
  await worker!.trigger();
  expect(worker!.getStatus().state).toBe("idle");
  const reference = await till.database.read((tx) =>
    tx.all<{ id: string }>(sql`SELECT id FROM reference WHERE entity = 'product' ORDER BY id`),
  );
  expect(reference.map((r) => r.id)).toEqual([older.entityId, current.entityId].sort());

  const safe = await tillCursor(till.database);
  await appendRows([{ v: 7, payload: { shape: "future" } }]);
  await worker!.trigger();
  expect(worker!.getStatus()).toMatchObject({ state: "upgrade", cursor: safe });
});

test("a till last synced at reference version 3 takes one snapshot that carries the customers, then pulls incrementally", async () => {
  till = await tillFile();
  await startAtHead(till.database);
  await till.database.transaction((tx) =>
    tx.run(sql`UPDATE till_state SET reference_version = 3, pull_initialized = 1`),
  );
  const live = await create("Live Ama", "0241230003");
  const gone = await create("Gone Ama", "0241230004");
  await archiveCustomer(db(), owner, { id: gone, now: new Date() });
  const winnerId = await create("Kept Ama", "0241230005");
  const loserId = await create("Merged Ama", "0241230005");
  await mergeCustomers(db(), owner, { winnerId, loserId, now: new Date() });

  upstream = await startHostUpstream(api);
  worker = createPullWorker(pullOptions(till.database, upstream.url, clock));
  const snapshots = () => upstream!.requests.filter((r) => r.path === "/sync/snapshot").length;
  await worker.trigger();
  expect(snapshots()).toBe(1);
  // Earlier tests left active customers on the server too, so look for ours and for the ones that must be absent.
  const shown = await ids(till.database);
  expect(shown).toEqual(expect.arrayContaining([live, winnerId]));
  expect(shown).not.toEqual(expect.arrayContaining([gone]));
  expect(shown).not.toEqual(expect.arrayContaining([loserId]));
  const state = await till.database.read((tx) =>
    tx.all<{ reference_version: number }>(
      sql`SELECT reference_version FROM till_state WHERE device_id = ${deviceId}`,
    ),
  );
  expect(state[0]!.reference_version).toBe(6);

  await create("After snapshot", "0241230006");
  await worker.trigger();
  expect(snapshots()).toBe(1);
  expect(await ids(till.database)).toHaveLength(shown.length + 1);
});

test("a snapshot rebuild keeps a customer whose upload is still pending", async () => {
  const counter = await startCounter();
  try {
    await counter.offline();
    const { customer } = await counter.create({ name: "Pending Kofi", phone: "0241230009" });
    // The server answers a snapshot that does not have the customer yet.
    // The host may be mid-write and the till file fails fast on a held lock, so try until it takes.
    await expect
      .poll(() =>
        counter.register.fixture.database
          .transaction((tx) => tx.run(sql`UPDATE till_state SET reference_version = 3`))
          .then(
            () => true,
            () => false,
          ),
      )
      .toBe(true);
    await counter.sync();
    expect(counter.upstream.requests.some((r) => r.path === "/sync/snapshot")).toBe(true);
    expect(await counter.find("0241230009")).toMatchObject({
      customers: [{ id: customer.id, name: "Pending Kofi", pending: true }],
    });
    expect(counter.uploads()).toHaveLength(0);

    await counter.online();
    expect(counter.wire()).toEqual(["sale", "customer.created"]);
    expect(await counter.find("0241230009")).toMatchObject({
      customers: [{ id: customer.id, pending: false, version: 1 }],
    });
  } finally {
    await counter.close();
  }
});
