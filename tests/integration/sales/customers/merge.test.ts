// A sale rung up to a customer that was merged away while the till was offline is stored against the winner.
import { afterAll, afterEach, beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { portalOwner } from "../../../support/api/portal";
import { customerApi } from "../../../support/customers/http";
import { sellTo, serverSale } from "../../../support/customers/sale";
import { startCounter } from "../../../support/customers/till";
import { ids } from "../../../support/till/sales";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let portal: ReturnType<typeof customerApi>;
let counter: Awaited<ReturnType<typeof startCounter>> | undefined;
beforeAll(async () => {
  world = await goldenWorld();
  const owner = await portalOwner(ids.org, ids.cashier);
  portal = customerApi(owner, owner.cookie);
});
afterAll(async () => world?.local.close());
afterEach(async () => {
  await counter?.close();
  counter = undefined;
});

test("a sale whose customer was merged into another is stored against the winner", async () => {
  const winner = v7();
  const loser = v7();
  for (const [id, name, phone] of [
    [winner, "Ama Mensah", "0271000031"],
    [loser, "Ama Mensa", "0271000032"],
  ])
    expect((await portal.create({ id, name, phone, kind: "individual" })).status).toBe(201);
  counter = await startCounter();
  await counter.settle();

  // The till never hears of the merge before it sells.
  counter.upstream.setPullAvailable(false);
  expect((await portal.merge(winner, loser)).status).toBe(200);
  const sold = await sellTo(counter, loser);
  expect(sold.sale.customer).toMatchObject({ id: loser, name: "Ama Mensa" });
  counter.upstream.setPullAvailable(true);
  await counter.settle();

  const stored = await serverSale(sold.saleId);
  expect(stored).toMatchObject({ customer_id: winner, event_version: 6 });
  expect((await portal.read(loser)).body).toMatchObject({ mergedIntoId: winner });
});
