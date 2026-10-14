import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeAll, expect, test, vi } from "vite-plus/test";
import { v7 } from "uuid";
import { createPullWorker } from "@shopper/sync";
import { archiveProduct, createProduct } from "@shopper/core/catalogue";
import { recordChanges } from "@shopper/core/changes";
import { api, context, databases } from "../../../support/till/server";
import {
  appendRows,
  head,
  pullOptions,
  startAtHead,
  storeId,
  tillAuditCommands,
  tillCursor,
  tillFile,
  tillReference,
} from "../../../support/till/pull";

const owner = { ...context, reason: "Pull worker test" };
const draft = () => ({
  sku: `PULL-${v7()}`,
  name: "Pulled product",
  baseUnit: "each",
  taxClass: "standard",
});
const clock = { now: Date.parse("2026-10-14T09:00:00.000Z") };
const names = async (database: Parameters<typeof tillReference>[0]) =>
  (await tillReference(database)).map((row) => (row.payload as { name: string }).name).sort();

let till: Awaited<ReturnType<typeof tillFile>>;
let worker: ReturnType<typeof createPullWorker> | undefined;
const start = async () => {
  till = await tillFile();
  const cursor = await startAtHead(till.database);
  worker = createPullWorker(pullOptions(till.database, api.url, clock));
  return cursor;
};
// A fresh database has head 0 and cursor 0 means "bootstrap" (slice 3), so every test starts above it.
beforeAll(() => appendRows([{}]));
afterEach(async () => {
  await worker?.stop();
  await till?.close();
});

test("upserts reach the till reference table and archiving a product removes it", async () => {
  const before = await start();
  const created = await createProduct(databases().db, owner, draft());
  await worker!.trigger();
  const rows = await tillReference(till.database);
  expect(rows).toMatchObject([
    { id: created.id, orgId: context.orgId, payload: { name: "Pulled product" } },
  ]);
  expect(BigInt((await tillCursor(till.database))!)).toBeGreaterThan(BigInt(before));
  expect(await tillCursor(till.database)).toBe(String(await head()));
  expect(worker!.getStatus()).toMatchObject({
    cursor: String(await head()),
    lastPullAt: clock.now,
  });

  clock.now += 60_000;
  await archiveProduct(databases().db, owner, { id: created.id });
  await worker!.trigger();
  expect(await tillReference(till.database)).toEqual([]);
  expect(await tillCursor(till.database)).toBe(String(await head()));
  expect(worker!.getStatus().lastPullAt).toBe(clock.now);
});

test("every page is one audited till.sync.pull command and a long feed is pulled to the end", async () => {
  await start();
  const rows = Array.from({ length: 600 }, (_, n) => {
    const id = v7();
    return {
      entityId: id,
      payload: {
        id,
        orgId: context.orgId,
        sku: `BULK-${n}`,
        name: `Bulk ${n}`,
        baseUnit: "each",
        taxClass: "standard",
        archivedAt: null,
        barcodes: [],
      },
    };
  });
  await databases().db.transaction((tx) =>
    recordChanges(
      tx,
      context.orgId,
      rows.map((row) => ({ entity: "product", op: "upsert", ...row })),
      [storeId],
    ),
  );
  await worker!.trigger();
  expect(await tillReference(till.database)).toHaveLength(600);
  expect(await tillCursor(till.database)).toBe(String(await head()));
  expect(
    (await tillAuditCommands(till.database)).filter((name) => name === "till.sync.pull"),
  ).toHaveLength(2);
});

test("the cursor survives a restart on the same SQLite file and only the tail is pulled", async () => {
  await start();
  const first = await createProduct(databases().db, owner, { ...draft(), name: "Before restart" });
  await worker!.trigger();
  const saved = await tillCursor(till.database);
  await worker!.stop();
  const database = await till.restart();
  expect(await tillCursor(database)).toBe(saved);
  worker = createPullWorker(pullOptions(database, api.url, clock));
  const second = await createProduct(databases().db, owner, { ...draft(), name: "After restart" });
  await worker.trigger();
  expect(await names(database)).toEqual(["After restart", "Before restart"]);
  expect((await tillReference(database)).map((row) => row.id).sort()).toEqual(
    [first.id, second.id].sort(),
  );
  expect(await tillCursor(database)).toBe(String(await head()));
  expect(worker.getStatus().cursor).toBe(String(await head()));
});

test("an unknown payload version halts the pull with upgrade needed and applies nothing from that page", async () => {
  await start();
  await createProduct(databases().db, owner, { ...draft(), name: "Applied first" });
  await worker!.trigger();
  const safe = await tillCursor(till.database);
  const known = (name: string) => {
    const id = v7();
    return {
      entityId: id,
      payload: {
        id,
        orgId: context.orgId,
        sku: id,
        name,
        baseUnit: "each",
        taxClass: "standard",
        archivedAt: null,
      },
    };
  };
  await appendRows([
    known("Same page, before"),
    { v: 3, payload: { shape: "future" } },
    known("Same page, after"),
  ]);
  await worker!.trigger();
  expect(worker!.getStatus()).toMatchObject({ state: "upgrade", cursor: safe });
  expect(await tillCursor(till.database)).toBe(safe);
  expect(await names(till.database)).toEqual(["Applied first"]);
  clock.now += 30_000;
  await worker!.trigger();
  expect(worker!.getStatus().state).toBe("upgrade");
  expect(await tillCursor(till.database)).toBe(safe);
  expect(await names(till.database)).toEqual(["Applied first"]);
});

test("a caught-up poll changes nothing, so it writes no audit row", async () => {
  await start();
  await worker!.trigger();
  const audits = (await tillAuditCommands(till.database)).length;
  await worker!.trigger();
  await worker!.trigger();
  expect(await tillAuditCommands(till.database)).toHaveLength(audits);
  expect(worker!.getStatus()).toMatchObject({ state: "idle", cursor: String(await head()) });
});

test("a host-controlled pull waits for its coordinator instead of retrying below thirty seconds", async () => {
  await start();
  await worker!.stop();
  let requests = 0;
  const server = createServer((_request, response) => {
    requests++;
    response.writeHead(503);
    response.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const upstream = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  worker = createPullWorker({ ...pullOptions(till.database, upstream, clock), retry: false });
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    await worker.trigger();
    expect(worker.getStatus().state).toBe("offline");
    await vi.advanceTimersByTimeAsync(29_999);
    expect(requests).toBe(1);
    vi.useRealTimers();
    await worker.trigger();
    expect(requests).toBe(2);
  } finally {
    await worker.stop();
    vi.useRealTimers();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("a malformed snapshot head preserves valid bridge status and the saved cursor", async () => {
  const cursor = await start();
  await worker!.stop();
  const audits = await tillAuditCommands(till.database);
  let requests = 0;
  const server = createServer((_request, response) => {
    requests++;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ snapshot: true, head: "bad" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const upstream = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  worker = createPullWorker({ ...pullOptions(till.database, upstream, clock), retry: false });
  try {
    await worker.trigger();
    expect(worker.getStatus()).toMatchObject({ state: "offline", cursor, head: null });
    expect(await tillCursor(till.database)).toBe(cursor);
    expect(await tillAuditCommands(till.database)).toEqual(audits);
    expect(requests).toBe(1);
  } finally {
    await worker.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
