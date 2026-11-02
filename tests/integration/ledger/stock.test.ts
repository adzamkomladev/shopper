// Stock documents post at cost: a costed receipt adds inventory owed to the supplier, and an adjustment moves
// inventory at the branch's last received cost against shrinkage (found stock reverses it). A product never received
// at a cost has no value to book, so its adjustment posts nothing.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { goldenWorld } from "../../support/sales/golden/setup";
import { products } from "../../fixtures/sales/golden/references";
import { ids } from "../../fixtures/sales/golden";
import { portalMember, portalOwner, type Portal } from "../../support/api/portal";
import { addSupplier } from "../../support/stock/seed";
import { send } from "../../support/stock/http";
import { entriesOf, trialBalanceZero } from "../../support/ledger/books";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let clerk: string;
let supplierId: string;
const rice = products.standard.id;
const tomatoes = products.weighed.id;

beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  clerk = await portalMember(owner, "inventory");
  supplierId = await addSupplier("Ledger Supplies");
});
afterAll(async () => {
  await world?.local.close();
});

const post = (path: string, body: unknown) => send(owner.api, clerk, "POST", path, body);
const adjust = async (productId: string, cause: string, quantityThousandths: number) => {
  const body = {
    id: v7(),
    branchId: ids.branch,
    cause,
    lines: [{ productId, quantityThousandths }],
  };
  expect((await post("/stock/adjustments", body)).status).toBe(201);
  return entriesOf("stock", body.id);
};

test("an adjustment of stock never received at a cost posts nothing", async () => {
  expect(await adjust(tomatoes, "found", 1_000)).toEqual([]);
});

test("a costed receipt books inventory against goods received", async () => {
  const receipt = {
    id: v7(),
    branchId: ids.branch,
    supplierId,
    lines: [
      { productId: rice, quantityThousandths: 24_000, unitCost: 95_000 },
      { productId: tomatoes, quantityThousandths: 10_500, unitCost: 280_000 },
    ],
  };
  expect((await post("/stock/receipts", receipt)).status).toBe(201);
  const value = 95_000 * 24 + 280_000 * 10.5;
  expect((await entriesOf("stock", receipt.id))[0]!.lines).toEqual({
    inventory: value,
    goods_received: -value,
  });
});

test("damage and found stock move inventory at the last received cost against shrinkage", async () => {
  expect((await adjust(rice, "damaged", 2_000))[0]!.lines).toEqual({
    inventory: -190_000,
    shrinkage: 190_000,
  });
  expect((await adjust(rice, "found", 500))[0]!.lines).toEqual({
    inventory: 47_500,
    shrinkage: -47_500,
  });
  expect(await trialBalanceZero()).toBe(true);
});
