// Slice 3: a till below the known reference version forces one full snapshot; bad v2 data halts as incompatible.
import { afterEach, expect, test } from "vite-plus/test";
import { searchCatalogue } from "@shopper/core/till";
import {
  code,
  ids,
  pageBody,
  product,
  pullWorker,
  referenceNames,
  referenceUpstream,
  setReferenceVersion,
  snapshotBody,
  tempTill,
  tillStateRow,
  upsert,
  type ReferenceUpstream,
} from "../../../support/till/catalogue";

let till: Awaited<ReturnType<typeof tempTill>>;
let upstream: ReferenceUpstream;
let worker: ReturnType<typeof pullWorker> | undefined;
afterEach(async () => {
  await worker?.stop();
  await upstream?.close();
  await till?.close();
  worker = undefined;
});

const search = (query: string) =>
  searchCatalogue(till.database, { orgId: ids.org, query }).then((rows) => rows.map((r) => r.name));
const run = async () => {
  worker = pullWorker(till.database, upstream.url);
  await worker.trigger();
  return worker;
};
const snapshots = () => upstream.urls.filter((url) => url.startsWith("/sync/snapshot")).length;

/** A till that synced under v1: it holds cursor 5 and a barcode-less "Old"; the server now serves `next`. */
async function v1Till(next: unknown) {
  till = await tempTill();
  upstream = await referenceUpstream(snapshotBody([product({ name: "Old" })], { cursor: "5" }));
  await (await run()).stop();
  await setReferenceVersion(till.database, 1);
  upstream.urls.length = 0;
  upstream.snapshot = next;
}

test("a till at reference_version 1 asks for cursor 0 once, takes a v2 snapshot and ends at version 2", async () => {
  const withBarcode = product({ name: "Packed", barcodes: [code("0012345", 6000)] });
  await v1Till(snapshotBody([withBarcode], { cursor: "9" }));
  expect(await tillStateRow(till.database)).toMatchObject({
    pull_cursor: "5",
    reference_version: 1,
  });

  await run();
  expect(upstream.urls[0]).toContain("cursor=0");
  expect(upstream.urls[0]).toContain("bootstrapped=false");
  expect(snapshots()).toBe(1);
  expect(upstream.urls.filter((url) => url.includes("cursor=0"))).toHaveLength(1);
  expect(await tillStateRow(till.database)).toMatchObject({
    pull_cursor: "9",
    reference_version: 2,
  });
  expect(await referenceNames(till.database)).toEqual(["Packed"]);
  expect(await search("0012345")).toEqual(["Packed"]);
  expect(await search("old")).toEqual([]);
});

test("a till already at the known version resumes from its cursor with no snapshot", async () => {
  till = await tempTill();
  upstream = await referenceUpstream(snapshotBody([product({ name: "Seeded" })], { cursor: "5" }));
  await (await run()).stop();
  expect(await tillStateRow(till.database)).toMatchObject({ reference_version: 2 });

  upstream.urls.length = 0;
  await run();
  expect(snapshots()).toBe(0);
  expect(upstream.urls[0]).toContain("cursor=5");
  expect(upstream.urls[0]).toContain("bootstrapped=true");
});

test("a server that still answers v1 does not loop the till through snapshots", async () => {
  await v1Till(snapshotBody([product({ name: "Barcode-less" })], { version: 1, cursor: "9" }));
  await run();
  expect(snapshots()).toBe(1);
  expect(upstream.urls.filter((url) => url.includes("cursor=0"))).toHaveLength(1);
  expect(upstream.urls.length).toBeLessThanOrEqual(3);
  expect(worker!.getStatus()).toMatchObject({ state: "idle", cursor: "9" });
  expect(await referenceNames(till.database)).toEqual(["Barcode-less"]);
});

test("an offline server during the forced snapshot leaves version 1, the cursor and the rows alone", async () => {
  await v1Till(snapshotBody([product({ name: "Fresh" })], { cursor: "9" }));
  upstream.status = 503;
  await run();
  expect(worker!.getStatus().state).toBe("offline");
  expect(await tillStateRow(till.database)).toMatchObject({
    pull_cursor: "5",
    reference_version: 1,
  });
  expect(await search("old")).toEqual(["Old"]);

  upstream.status = 200;
  await worker!.trigger();
  expect(await tillStateRow(till.database)).toMatchObject({
    pull_cursor: "9",
    reference_version: 2,
  });
  expect(await search("fresh")).toEqual(["Fresh"]);
});

test("a malformed v2 row halts as incompatible and changes neither cursor, rows nor index", async () => {
  till = await tempTill();
  upstream = await referenceUpstream(snapshotBody([product({ name: "Seeded" })], { cursor: "5" }));
  await (await run()).stop();
  await setReferenceVersion(till.database, 2);
  const { barcodes: _gone, ...noBarcodes } = product({ name: "Broken" });
  upstream.pages.push(
    pageBody(8, [upsert(6, product({ name: "Good first" })), upsert(7, noBarcodes as never)]),
  );
  upstream.urls.length = 0;

  await run();
  expect(worker!.getStatus()).toMatchObject({ state: "incompatible", cursor: "5" });
  expect(await tillStateRow(till.database)).toMatchObject({
    pull_cursor: "5",
    reference_version: 2,
  });
  expect(await referenceNames(till.database)).toEqual(["Seeded"]);
  expect(await search("good")).toEqual([]);
  expect(await search("broken")).toEqual([]);
  expect(await search("seeded")).toEqual(["Seeded"]);

  await worker!.trigger();
  expect(upstream.urls).toHaveLength(1);
  expect(worker!.getStatus().state).toBe("incompatible");
});

test("an archived product upsert removes it from the reference table and the lookup", async () => {
  till = await tempTill();
  const kept = product({ name: "Kept", barcodes: [code("0011111")] });
  const sold = product({ name: "Discontinued", barcodes: [code("0022222")] });
  upstream = await referenceUpstream(snapshotBody([kept, sold], { cursor: "5" }));
  await (await run()).stop();
  expect(await search("discontinued")).toEqual(["Discontinued"]);

  upstream.pages.push(
    pageBody(6, [upsert(6, { ...sold, archivedAt: "2026-10-14T08:00:00.000Z" })]),
  );
  await run();
  expect(await referenceNames(till.database)).toEqual(["Kept"]);
  expect(await search("discontinued")).toEqual([]);
  expect(await search("0022222")).toEqual([]);
  expect(await search("0011111")).toEqual(["Kept"]);
  expect(await tillStateRow(till.database)).toMatchObject({ pull_cursor: "6" });
});

test("applying a snapshot ignores archived rows in both the reference table and the lookup", async () => {
  till = await tempTill();
  const live = product({ name: "Live", barcodes: [code("0033333")] });
  const archived = product({
    name: "Archived",
    barcodes: [code("0044444")],
    archivedAt: "2026-09-01T00:00:00.000Z",
  });
  upstream = await referenceUpstream(snapshotBody([live, archived], { cursor: "5" }));
  await run();
  expect(await referenceNames(till.database)).toEqual(["Live"]);
  expect(await search("archived")).toEqual([]);
  expect(await search("0044444")).toEqual([]);
  expect(await search("live")).toEqual(["Live"]);
});
