// Notion Day 19: "SDC down → sale completes, doc pending → SDC up → accepted". Done when: fiscalisation never blocks
// a sale. With the SDC unreachable the upload is accepted at once and its document waits; once the SDC is back the
// store's lane submits it, the SDC signs it, and the signature goes to the store's tills on the feed.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { fiscalDoc, storeChange } from "@shopper/db-pg";
import { boxLane } from "@shopper/adapters-box";
import { createSdc } from "@shopper/core/fiscal";
import type { GoldenSale } from "../../fixtures/sales/golden/types";
import { goldenWorld } from "../../support/sales/golden/setup";
import { ringGolden } from "../../support/sales/golden/run";
import { pushEvents } from "../../support/till/requests";
import { api } from "../../support/till/server";
import { useLane } from "../../support/fiscal/lane";
import { startSdcFake } from "../../../tooling/sdc/server";

const scenario: GoldenSale = {
  name: "fiscal outage",
  lines: [{ product: "standard", quantity: 1_000 }],
  tenders: [{ kind: "cash", amount: 500_000 }],
};
const fake = await startSdcFake();
let world: Awaited<ReturnType<typeof goldenWorld>>;
let lane: ReturnType<typeof boxLane>;
beforeAll(async () => {
  world = await goldenWorld();
  lane = boxLane({
    db: world.db,
    sdc: createSdc({ url: fake.url, apiKey: fake.apiKey }),
    appVersion: world.config.appVersion,
  });
  useLane(lane);
});
afterAll(async () => {
  useLane(undefined);
  lane.close();
  await world?.local.close();
  await fake.stop();
});

test("SDC down → sale completes, doc pending → SDC up → accepted", async () => {
  fake.down();
  const event = (await ringGolden(world, scenario))!;
  const started = Date.now();
  const response = await pushEvents(
    api,
    [event],
    [{ sessionId: world.session.id, proof: world.session.proof }],
  );
  // The sale is accepted while the SDC is unreachable, and the upload does not wait for it.
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    accepted: [{ localId: event.sale.localId }],
    rejected: [],
  });
  expect(Date.now() - started).toBeLessThan(5_000);
  const doc = async () =>
    (await world.db.select().from(fiscalDoc).where(eq(fiscalDoc.saleId, event.sale.id)))[0]!;
  await expect.poll(async () => (await doc()).attempts).toBeGreaterThan(0);
  expect(await doc()).toMatchObject({ status: "pending", signature: null });
  expect((await doc()).lastError).toMatch(/SDC/);
  expect(fake.arrivals).toEqual([]);

  fake.up();
  await lane.wake(event.sale.orgId, event.sale.storeId);
  const signed = await doc();
  expect(signed).toMatchObject({ status: "accepted", sdcId: fake.sdcId });
  expect(fake.arrivals.map((arrival) => arrival.invoiceNumber)).toEqual([event.sale.receiptNumber]);
  const [change] = await world.db
    .select()
    .from(storeChange)
    .where(and(eq(storeChange.entity, "fiscal-doc"), eq(storeChange.entityId, signed.id)));
  expect(change).toMatchObject({
    storeId: event.sale.storeId,
    v: 6,
    payload: { saleId: event.sale.id, signature: signed.signature, qr: signed.qr },
  });
});
