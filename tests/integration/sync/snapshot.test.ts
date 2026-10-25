import { afterAll, afterEach, beforeAll, expect, test } from "vite-plus/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { v7 } from "uuid";
import { boxBlobs } from "@shopper/adapters-box";
import { createPullWorker, createPushWorker } from "@shopper/sync";
import { createProduct } from "@shopper/core/catalogue";
import { readQuoteReference } from "@shopper/core/till";
import { org } from "@shopper/db-pg";
import { eq } from "drizzle-orm";
import {
  api,
  context,
  databases,
  devices,
  routeFactory,
  sequencer,
} from "../../support/till/server";
import { serveHono, type HttpClient } from "../../support/till/http";
import {
  appendRows,
  bulkRows,
  head,
  pull,
  pullHeaders,
  pullOptions,
  startAtHead,
  storeId,
  tillAuditCommands,
  tillCursor,
  tillFile,
  tillReference,
} from "../../support/till/pull";

let directory: string;
let server: HttpClient;
let blobs: Awaited<ReturnType<typeof boxBlobs>>["blobs"];
let writes: string[] = [];
let till: Awaited<ReturnType<typeof tillFile>> | undefined;
let worker: ReturnType<typeof createPullWorker> | undefined;
const clock = { now: Date.parse("2026-10-14T09:00:00Z") };
const draft = () => ({
  sku: v7(),
  name: "Snapshot product",
  baseUnit: "each",
  taxClass: "standard",
});
const owner = { ...context, reason: "Snapshot integration" };

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "shopper-snapshots-"));
  blobs = (await boxBlobs(directory, { baseUrl: api.url, secret: new Uint8Array(32).fill(7) }))
    .blobs;
  const storage = {
    ...blobs,
    async put(orgId: string, key: string, value: Uint8Array) {
      writes.push(key);
      await blobs.put(orgId, key, value);
    },
  };
  server = await serveHono(
    routeFactory({ database: databases().db, devices, sequencer, blobs: storage }),
  );
});
afterEach(async () => {
  await worker?.stop();
  await till?.close();
  worker = undefined;
  till = undefined;
});
afterAll(async () => {
  await server?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

const snapshot = () => server.request("/sync/snapshot", { headers: pullHeaders() });
const start = async () => {
  till = await tillFile();
  worker = createPullWorker(pullOptions(till.database, server.url, clock));
  await worker.trigger();
};

test("a new till bootstraps at head zero and clears snapshot state", async () => {
  expect(await head()).toBe(0n);
  await start();
  expect(await tillCursor(till!.database)).toBe("0");
  expect(worker!.getStatus()).toMatchObject({ state: "idle", cursor: "0", lastPullAt: clock.now });
  expect(await tillAuditCommands(till!.database)).toContain("till.sync.snapshot");
  await worker!.trigger();
  expect(
    (await tillAuditCommands(till!.database)).filter((name) => name === "till.sync.snapshot"),
  ).toHaveLength(1);
});

test("receipt state created before the first pull still bootstraps references", async () => {
  till = await tillFile();
  const pushWorker = createPushWorker(pullOptions(till.database, server.url, clock));
  try {
    await pushWorker.trigger();
  } finally {
    await pushWorker.stop();
  }
  worker = createPullWorker(pullOptions(till.database, server.url, clock));
  await worker.trigger();
  expect(await tillAuditCommands(till.database)).toContain("till.sync.snapshot");
  expect(await tillReference(till.database)).not.toHaveLength(0);
});

test("a new till receives products, prices and tax rules in one audited snapshot", async () => {
  const created = await createProduct(databases().db, owner, draft());
  await start();
  expect((await tillReference(till!.database)).map((row) => row.id)).toContain(created.id);
  expect(await tillReference(till!.database, "price")).not.toHaveLength(0);
  expect(await tillReference(till!.database, "tax-rule")).not.toHaveLength(0);
  expect(await tillCursor(till!.database)).toBe(String(await head()));
  expect(
    (await tillAuditCommands(till!.database)).filter((name) => name === "till.sync.snapshot"),
  ).toHaveLength(1);
});

test("the gzip blob key includes tenant, store and version and the same snapshot is reused", async () => {
  writes = [];
  await appendRows([{}]);
  const first = await snapshot();
  expect(first.status).toBe(200);
  expect(first.headers.get("content-encoding")).toBe("gzip");
  const data = await first.json();
  expect(await (await snapshot()).json()).toEqual(data);
  expect(writes).toEqual([`snapshots/${context.orgId}/${storeId}/v6/${await head()}.json.gz`]);
  const stored = await blobs.get(context.orgId, writes[0]!);
  expect(Array.from(stored!.slice(0, 2))).toEqual([31, 139]);
});

test("more than 50,000 pending rows replace stale till references with a snapshot", async () => {
  till = await tillFile();
  await startAtHead(till.database);
  await bulkRows(50_001);
  expect(await (await pull(server, { cursor: "1" })).json()).toMatchObject({ snapshot: true });
  worker = createPullWorker(pullOptions(till.database, server.url, clock));
  await worker.trigger();
  expect(worker.getStatus().state).toBe("idle");
  expect(await tillCursor(till.database)).toBe(String(await head()));
  expect(await tillAuditCommands(till.database)).toContain("till.sync.snapshot");
});

test("snapshot plus tail equals a fresh snapshot and never duplicates rows", async () => {
  await start();
  const created = await createProduct(databases().db, owner, draft());
  await worker!.trigger();
  const data = (await (await snapshot()).json()) as { reference: { products: { id: string }[] } };
  const actual = await tillReference(till!.database);
  expect(actual.map((row) => row.id).sort()).toEqual(
    data.reference.products.map((row) => row.id).sort(),
  );
  expect(actual.filter((row) => row.id === created.id)).toHaveLength(1);
  expect(await tillCursor(till!.database)).toBe(String(await head()));
});

test("snapshot access rejects foreign credentials and incompatible protocols", async () => {
  expect((await server.request("/sync/snapshot")).status).toBe(401);
  expect(
    (
      await server.request("/sync/snapshot", {
        headers: { ...pullHeaders(), "X-Shopper-Org": v7() },
      })
    ).status,
  ).toBe(401);
  expect((await server.request("/sync/snapshot", { headers: pullHeaders(99) })).status).toBe(409);
});

test("a new till receives the organisation's cash rounding, 10p by default", async () => {
  await start();
  const data = (await (await snapshot()).json()) as {
    reference: { settings: { cashRounding: string } };
  };
  expect(data.reference.settings.cashRounding).toBe("10p");
  const refs = await till!.database.read((tx) => readQuoteReference(tx, context.orgId));
  expect(refs.cashRounding).toBe("10p");
});

test("a snapshot carries cash rounding none after the organisation switches it off", async () => {
  await databases().db.update(org).set({ cashRounding: "none" }).where(eq(org.id, context.orgId));
  try {
    await appendRows([{}]);
    await start();
    const refs = await till!.database.read((tx) => readQuoteReference(tx, context.orgId));
    expect(refs.cashRounding).toBe("none");
  } finally {
    await databases().db.update(org).set({ cashRounding: "10p" }).where(eq(org.id, context.orgId));
  }
});
