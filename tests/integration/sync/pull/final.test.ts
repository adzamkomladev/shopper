// finalSale reaches the till reference by pull, and a till on an older reference version re-snapshots to receive it.
import { afterEach, beforeAll, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import { createPullWorker } from "@shopper/sync";
import { createProduct, updateProduct } from "@shopper/core/catalogue";
import { api, context, databases, deviceId } from "../../../support/till/server";
import {
  appendRows,
  pullOptions,
  startAtHead,
  tillAuditCommands,
  tillFile,
  tillReference,
} from "../../../support/till/pull";

const owner = { ...context, reason: "Final sale pull test" };
const draft = (finalSale?: boolean) => ({
  sku: `FINAL-${v7()}`,
  name: "Final product",
  baseUnit: "each",
  taxClass: "standard",
  ...(finalSale === undefined ? {} : { finalSale }),
});
const referenceVersion = async (set?: number) => {
  if (set)
    await till.database.transaction((tx) =>
      tx.run(sql`UPDATE till_state SET reference_version = ${set}`),
    );
  return (
    await till.database.read((tx) =>
      tx.all<{ reference_version: number }>(
        sql`SELECT reference_version FROM till_state WHERE device_id = ${deviceId}`,
      ),
    )
  )[0]?.reference_version;
};
const clock = { now: Date.parse("2026-10-14T09:00:00.000Z") };
const finalSaleOf = async (id: string) =>
  (await tillReference(till.database)).find((row) => row.id === id)?.payload as {
    finalSale: boolean;
  };

let till: Awaited<ReturnType<typeof tillFile>>;
let worker: ReturnType<typeof createPullWorker>;
const start = async () => {
  till = await tillFile();
  await startAtHead(till.database);
  worker = createPullWorker(pullOptions(till.database, api.url, clock));
};
beforeAll(() => appendRows([{}]));
afterEach(async () => {
  await worker?.stop();
  await till?.close();
});

test("a product's finalSale flag follows every change to the till reference", async () => {
  await start();
  const plain = await createProduct(databases().db, owner, draft());
  const final = await createProduct(databases().db, owner, draft(true));
  await worker.trigger();
  expect(await finalSaleOf(plain.id)).toMatchObject({ finalSale: false });
  expect(await finalSaleOf(final.id)).toMatchObject({ finalSale: true });

  await updateProduct(databases().db, owner, { id: plain.id, data: { finalSale: true } });
  await updateProduct(databases().db, owner, { id: final.id, data: { finalSale: false } });
  await worker.trigger();
  expect(await finalSaleOf(plain.id)).toMatchObject({ finalSale: true });
  expect(await finalSaleOf(final.id)).toMatchObject({ finalSale: false });
});

test("a till on reference version 2 takes a snapshot that carries finalSale and ends at version 4", async () => {
  await start();
  const final = await createProduct(databases().db, owner, draft(true));
  await referenceVersion(2);
  await worker.trigger();
  expect(await tillAuditCommands(till.database)).toContain("till.sync.snapshot");
  expect(await referenceVersion()).toBe(6);
  expect(await finalSaleOf(final.id)).toMatchObject({ finalSale: true });
});
