// Notion Day 39 drill: the box's LTE (its only way out) is down for 48 hours → the fiscal queue drains on return. The
// store sells all the while; every document waits. Over 48 hours the lane, backing off to once an hour, tries the head
// about sixty times without ever reaching the SDC. A try that never reached the SDC is not the SDC failing the
// document, so none is dead-lettered: when the line comes back every document is signed, once, in the order sold.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { asc, eq, inArray } from "drizzle-orm";
import { fiscalDoc } from "@shopper/db-pg";
import { boxLane } from "@shopper/adapters-box";
import { createSdc, FISCAL_MAX_ATTEMPTS } from "@shopper/core/fiscal";
import type { GoldenSale } from "../../fixtures/sales/golden/types";
import { goldenWorld } from "../../support/sales/golden/setup";
import { ringGolden } from "../../support/sales/golden/run";
import { pushEvents } from "../../support/till/requests";
import { api } from "../../support/till/server";
import { useLane } from "../../support/fiscal/lane";
import { startSdcFake } from "../../../tooling/sdc/server";

const scenario: GoldenSale = {
  name: "LTE outage",
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

test("48 hours with no way out: sales go on, nothing is dead-lettered, and the queue drains in order on return", async () => {
  fake.down();
  const sold: string[] = [];
  // Twelve sales across the two days; between them the lane keeps trying its head and never gets through.
  for (let hour = 0; hour < 60; hour++) {
    if (hour % 5 === 0) {
      const event = (await ringGolden(world, scenario))!;
      const response = await pushEvents(
        api,
        [event],
        [{ sessionId: world.session.id, proof: world.session.proof }],
      );
      expect(response.status).toBe(200);
      sold.push(event.sale.id);
    }
    await lane.wake(world.session.orgId, world.config.storeId);
  }
  const docs = () =>
    world.db
      .select()
      .from(fiscalDoc)
      .where(inArray(fiscalDoc.saleId, sold))
      .orderBy(asc(fiscalDoc.createdAt));
  expect(fake.arrivals).toEqual([]);
  expect((await docs()).map((doc) => doc.status)).toEqual(sold.map(() => "pending"));
  expect((await docs())[0]!.lastError).toMatch(/could not be reached/);

  fake.up();
  await lane.wake(world.session.orgId, world.config.storeId);
  const signed = await docs();
  expect(signed.map((doc) => doc.status)).toEqual(sold.map(() => "accepted"));
  expect(fake.arrivals.map((arrival) => arrival.invoiceNumber)).toEqual(
    signed.map((doc) => doc.invoiceNumber),
  );
});

test("a document the SDC itself keeps failing is still dead-lettered, so it cannot hold the lane forever", async () => {
  const event = (await ringGolden(world, scenario))!;
  fake.failNext(FISCAL_MAX_ATTEMPTS + 5);
  await pushEvents(api, [event], [{ sessionId: world.session.id, proof: world.session.proof }]);
  for (let attempt = 0; attempt < FISCAL_MAX_ATTEMPTS; attempt++)
    await lane.wake(world.session.orgId, world.config.storeId);
  const [doc] = await world.db.select().from(fiscalDoc).where(eq(fiscalDoc.saleId, event.sale.id));
  expect(doc).toMatchObject({ status: "dead", lastError: "The SDC replied 503" });
});
