// Codex review of Day 19: an upload is acknowledged even when its document could not be put on the store's lane, so
// nothing would queue it again. Every till pulls at least every five minutes; a pull hands the store's oldest stranded
// document back to the lane, whose drain then adopts the rest. A document younger than the cutoff is left alone, as
// its own enqueue may still be on the way.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { fiscalDoc } from "@shopper/db-pg";
import { STRANDED_AFTER_MS } from "@shopper/core/fiscal";
import type { GoldenSale } from "../../fixtures/sales/golden/types";
import { goldenWorld } from "../../support/sales/golden/setup";
import { ringGolden } from "../../support/sales/golden/run";
import { pushEvents } from "../../support/till/requests";
import { pull } from "../../support/till/pull";
import { api } from "../../support/till/server";
import { enqueued, useLane } from "../../support/fiscal/lane";

const scenario: GoldenSale = {
  name: "stranded fiscal document",
  lines: [{ product: "standard", quantity: 1_000 }],
  tenders: [{ kind: "cash", amount: 500_000 }],
};
let world: Awaited<ReturnType<typeof goldenWorld>>;
beforeAll(async () => {
  world = await goldenWorld();
});
afterAll(async () => {
  useLane(undefined);
  await world?.local.close();
});

test("a document whose enqueue was lost goes back on its lane at the store's next pull", async () => {
  useLane({
    enqueue: async () => {
      throw new Error("lane unreachable");
    },
  });
  const event = (await ringGolden(world, scenario))!;
  const response = await pushEvents(
    api,
    [event],
    [{ sessionId: world.session.id, proof: world.session.proof }],
  );
  expect(response.status).toBe(200);
  useLane(undefined);
  const [doc] = await world.db.select().from(fiscalDoc).where(eq(fiscalDoc.saleId, event.sale.id));
  expect(doc).toMatchObject({ status: "pending" });
  const before = enqueued.length;

  expect((await pull(api, { cursor: 0, limit: 1 })).status).toBe(200);
  expect(enqueued.slice(before)).toEqual([]);

  await world.db
    .update(fiscalDoc)
    .set({ createdAt: new Date(Date.now() - STRANDED_AFTER_MS - 1_000) })
    .where(eq(fiscalDoc.id, doc!.id));
  expect((await pull(api, { cursor: 0, limit: 1 })).status).toBe(200);
  expect(enqueued.slice(before)).toEqual([
    { orgId: doc!.orgId, storeId: doc!.storeId, docId: doc!.id },
  ]);
});
