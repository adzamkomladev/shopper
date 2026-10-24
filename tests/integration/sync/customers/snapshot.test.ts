// The server side of feed v4: a customer change is a v4 `customer` row for every store, and the snapshot lists the
// active customers (not archived, not merged) with exactly the fields a till needs.
import { gunzipSync } from "node:zlib";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { v7 } from "uuid";
import { boxBlobs } from "@shopper/adapters-box";
import { buildSnapshot } from "@shopper/core/changes";
import {
  archiveCustomer,
  createCustomer,
  mergeCustomers,
  updateCustomer,
} from "@shopper/core/customers";
import { openFeed } from "../../../support/till/feed";

let feed: Awaited<ReturnType<typeof openFeed>>;
let directory: string;
let blobs: Awaited<ReturnType<typeof boxBlobs>>["blobs"];
beforeAll(async () => {
  feed = await openFeed();
  directory = await mkdtemp(join(tmpdir(), "shopper-customer-snapshot-"));
  blobs = (
    await boxBlobs(directory, {
      baseUrl: "https://shopper.test/blobs",
      secret: new Uint8Array(32).fill(5),
    })
  ).blobs;
});
afterAll(async () => {
  await feed?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

type World = Awaited<ReturnType<typeof feed.world>>;
const context = (world: World) => ({ ...world.context, reason: "Customer snapshot" });
async function add(world: World, name: string, phone = "0241234567", extra: object = {}) {
  const id = v7();
  await createCustomer(feed.db, context(world), {
    customer: { id, name, phone, email: "private@example.test", ...extra },
  });
  return id;
}
async function snapshotOf(world: World, storeId = world.stores[0]!) {
  const bytes = await buildSnapshot(
    feed.db,
    blobs,
    { orgId: world.orgId, storeId },
    context(world),
  );
  return JSON.parse(gunzipSync(bytes).toString()) as {
    v: number;
    reference: { customers: { id: string; name: string }[] };
  };
}

test("a customer change is a v5 customer row on every store, carrying only what the till needs", async () => {
  const world = await feed.world(3);
  const id = await add(world, "Ama Mensah", "0241234567", {
    kind: "business",
    businessName: "Ama Stores",
    tin: "C0012345678",
  });
  for (const storeId of world.stores) {
    const rows = await feed.changes(world.orgId, { storeId, entity: "customer" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ entity_id: id, op: "upsert", v: 5 });
    expect(rows[0]!.payload).toEqual({
      id,
      orgId: world.orgId,
      name: "Ama Mensah",
      phone: "0241234567",
      kind: "business",
      businessName: "Ama Stores",
      tin: "C0012345678",
      version: 1,
      archivedAt: null,
      mergedIntoId: null,
    });
  }
  await updateCustomer(feed.db, context(world), { id, patch: { name: "Ama Owusu" } });
  const rows = await feed.changes(world.orgId, { storeId: world.stores[0], entity: "customer" });
  expect(rows.map((r) => r.v)).toEqual([5, 5]);
  expect(rows.at(-1)!.payload).toMatchObject({ name: "Ama Owusu", version: 2 });
});

test("the snapshot is v4 and lists active customers only, never another organisation's", async () => {
  const mine = await feed.world(2);
  const theirs = await feed.world(1);
  const active = await add(mine, "Active Ama", "0241230001");
  const archived = await add(mine, "Archived Ama", "0241230002");
  await archiveCustomer(feed.db, context(mine), { id: archived, now: new Date() });
  const winner = await add(mine, "Winner Ama", "0241230003");
  const loser = await add(mine, "Loser Ama", "0241230003");
  await mergeCustomers(feed.db, context(mine), {
    winnerId: winner,
    loserId: loser,
    now: new Date(),
  });
  const foreign = await add(theirs, "Foreign Ama", "0241230004");

  for (const storeId of mine.stores) {
    const snapshot = await snapshotOf(mine, storeId);
    expect(snapshot.v).toBe(5);
    expect(snapshot.reference.customers.map((c) => c.id).sort()).toEqual([active, winner].sort());
  }
  const text = JSON.stringify(await snapshotOf(mine));
  expect(text).not.toContain(foreign);
  expect(text).not.toContain("private@example.test");
  expect(text).not.toMatch(/creditLimit|email/);
});

test("a snapshot without customers still lists an empty array so a v4 till can tell", async () => {
  const world = await feed.world(1);
  expect((await snapshotOf(world)).reference.customers).toEqual([]);
});
