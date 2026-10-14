// Slice 3: provisioning, page apply and snapshot apply keep the lookup + FTS index in step, atomically.
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { projectProducts, provisionTillReference, searchCatalogue } from "@shopper/core/till";
import { foreignProduct, references } from "../../../support/till/sales";
import {
  appVersion,
  code,
  ids,
  pageBody,
  product,
  pullWorker,
  referenceNames,
  referenceUpstream,
  remove,
  snapshotBody,
  setReferenceVersion,
  tempTill,
  tillStateRow,
  upsert,
  type ReferenceUpstream,
} from "../../../support/till/catalogue";

let till: Awaited<ReturnType<typeof tempTill>>;
let upstream: ReferenceUpstream | undefined;
let worker: ReturnType<typeof pullWorker> | undefined;
beforeEach(async () => {
  till = await tempTill();
});
afterEach(async () => {
  await worker?.stop();
  await upstream?.close();
  await till.close();
  worker = upstream = undefined;
});

const search = (query: string, orgId: string = ids.org) =>
  searchCatalogue(till.database, { orgId, query }).then((rows) => rows.map((row) => row.name));
const sync = async () => {
  worker ??= pullWorker(till.database, upstream!.url);
  await worker.trigger();
};
/** Seeds the till through a real snapshot pull: A (with a barcode) and B at cursor 5, reference version 2. */
async function seeded() {
  const a = product({ name: "Alpha", barcodes: [code("0011111")] });
  const b = product({ name: "Bravo" });
  upstream = await referenceUpstream(snapshotBody([a, b], { cursor: "5" }));
  await sync();
  return { a, b };
}
const failCursor = async (cursor: string, on: boolean) => {
  for (const event of ["INSERT", "UPDATE"])
    await till.database.transaction((tx) =>
      tx.run(
        sql.raw(
          on
            ? `CREATE TRIGGER fail_${event} BEFORE ${event} ON till_state WHEN NEW.pull_cursor = '${cursor}' BEGIN SELECT RAISE(ABORT, 'injected failure'); END`
            : `DROP TRIGGER fail_${event}`,
        ),
      ),
    );
};
const provisionContext = {
  orgId: ids.org,
  actorId: ids.cashier,
  role: "Cashier",
  deviceId: ids.device,
  branchId: ids.branch,
  appVersion,
};

test("provisioning indexes products by name and SKU in the same transaction", async () => {
  await provisionTillReference(till.database, provisionContext, references);
  expect(await search("fresh")).toEqual(["Fresh milk"]);
  expect(await search("MILK-001")).toEqual(["Fresh milk"]);
  await provisionTillReference(till.database, provisionContext, {
    ...references,
    products: [{ ...references.products[0]!, name: "Renamed milk" }],
  });
  expect(await search("fresh")).toEqual([]);
  expect(await search("renamed")).toEqual(["Renamed milk"]);
});

test("a provisioning failure leaves neither reference rows nor index entries", async () => {
  await expect(
    provisionTillReference(till.database, provisionContext, {
      ...references,
      products: [...references.products, foreignProduct],
    }),
  ).rejects.toThrow();
  expect(await referenceNames(till.database)).toEqual([]);
  expect(await search("fresh")).toEqual([]);
  expect(await search("other", ids.otherOrg)).toEqual([]);
});

test("a page renames, re-barcodes, deletes and adds products in the index", async () => {
  const { a, b } = await seeded();
  const added = product({ name: "Charlie", barcodes: [code("0033333", 4000)] });
  upstream!.pages.push(
    pageBody(9, [
      upsert(6, { ...a, name: "Alpha prime", barcodes: [code("0022222", 2000)] }),
      remove(7, b.id),
      upsert(8, added),
    ]),
  );
  await sync();
  expect(await search("alpha")).toEqual(["Alpha prime"]);
  expect(await search("0011111")).toEqual([]);
  expect(await search("0022222")).toEqual(["Alpha prime"]);
  expect(await search("bravo")).toEqual([]);
  expect(await search("0033333")).toEqual(["Charlie"]);
  expect(await referenceNames(till.database)).toEqual(["Alpha prime", "Charlie"]);
  expect(await tillStateRow(till.database)).toMatchObject({ pull_cursor: "9" });
});

test("a snapshot replaces its organisation's index and leaves other organisations alone", async () => {
  const other = product({ orgId: ids.otherOrg, name: "Neighbour" });
  await till.database.transaction((tx) => projectProducts(tx, ids.otherOrg, [other]));
  await seeded();
  expect(await search("neighbour", ids.otherOrg)).toEqual(["Neighbour"]);

  upstream!.snapshot = snapshotBody([product({ name: "Delta" })], { cursor: "20" });
  await setReferenceVersion(till.database, 1);
  await sync();
  expect(await search("alpha")).toEqual([]);
  expect(await search("0011111")).toEqual([]);
  expect(await search("delta")).toEqual(["Delta"]);
  expect(await search("neighbour", ids.otherOrg)).toEqual(["Neighbour"]);
});

test("a failure after the index was updated rolls back the page, the index and the cursor", async () => {
  const { a } = await seeded();
  upstream!.pages.push(
    pageBody(777, [
      upsert(6, { ...a, name: "Alpha renamed" }),
      upsert(7, product({ name: "Echo" })),
    ]),
  );
  await failCursor("777", true);
  await sync();
  expect(worker!.getStatus().state).toBe("offline");
  expect(await tillStateRow(till.database)).toMatchObject({
    pull_cursor: "5",
    reference_version: 2,
  });
  expect(await referenceNames(till.database)).toEqual(["Alpha", "Bravo"]);
  expect(await search("alpha")).toEqual(["Alpha"]);
  expect(await search("echo")).toEqual([]);
  expect(await search("0011111")).toEqual(["Alpha"]);

  await failCursor("777", false);
  upstream!.pages.push(pageBody(8, [upsert(6, { ...a, name: "Alpha renamed" })]));
  await sync();
  expect(await search("renamed")).toEqual(["Alpha renamed"]);
  expect(await tillStateRow(till.database)).toMatchObject({ pull_cursor: "8" });
});

test("a failure while applying a snapshot keeps the previous index, rows, cursor and version", async () => {
  await seeded();
  upstream!.snapshot = snapshotBody([product({ name: "Foxtrot" })], { cursor: "777" });
  await setReferenceVersion(till.database, 1);
  await failCursor("777", true);
  await sync();
  expect(worker!.getStatus().state).toBe("offline");
  expect(await tillStateRow(till.database)).toMatchObject({
    pull_cursor: "5",
    reference_version: 1,
  });
  expect(await referenceNames(till.database)).toEqual(["Alpha", "Bravo"]);
  expect(await search("alpha")).toEqual(["Alpha"]);
  expect(await search("0011111")).toEqual(["Alpha"]);
  expect(await search("foxtrot")).toEqual([]);
});

test("the index survives a restart of the till database", async () => {
  await seeded();
  await worker!.stop();
  await till.restart();
  expect(await search("alp")).toEqual(["Alpha"]);
  expect(await search("0011111")).toEqual(["Alpha"]);
  expect(await search("bravo")).toEqual(["Bravo"]);
  expect(await search("zulu")).toEqual([]);
});
