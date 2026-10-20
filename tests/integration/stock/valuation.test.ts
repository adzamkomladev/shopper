import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { product } from "@shopper/db-pg";
import { databases } from "../../support/till/server";
import { goldenWorld } from "../../support/sales/golden/setup";
import { products } from "../../fixtures/sales/golden/references";
import { ids } from "../../fixtures/sales/golden";
import { get, portalMember, portalOwner, type Portal } from "../../support/api/portal";
import { addBranch, addDocument, addMovements, addSupplier } from "../../support/stock/seed";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
const rice = products.standard.id;
const tomatoes = products.weighed.id;
const rounding = products.zero.id;
const noCost = products.exempt.id;
const negative = products.labelled.id;

beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  const supplierId = await addSupplier("Valuation Supplies");
  const receive = (productId: string, quantity: number, unitCost?: number, branchId?: string) =>
    addDocument({
      kind: "receipt",
      supplierId,
      at: "08:00",
      branchId,
      lines: [{ productId, quantity, unitCost }],
    });
  // Rice was 90 000 before the last receipt at 100 000; 20 000 in, 5 000 sold off -> 15 000.
  await receive(rice, 1_000, 90_000);
  await addDocument({
    kind: "receipt",
    supplierId,
    at: "09:00",
    lines: [{ productId: rice, quantity: 19_000, unitCost: 100_000 }],
  });
  await addMovements([{ productId: rice, quantity: -5_000, at: "10:00" }]);
  await receive(tomatoes, 2_500, 280_000);
  await receive(rounding, 333, 10_001);
  await addMovements([{ productId: noCost, quantity: 4_000, at: "08:00" }]);
  await addMovements([{ productId: negative, quantity: -1_000, at: "08:00" }]);
  const other = await addBranch(world.config.storeId);
  await receive(rice, 50_000, 500_000, other);
});
afterAll(async () => {
  await world?.local.close();
});

test("Valuation is on hand times the last received unit cost, with flags and a total", async () => {
  const { status, body } = await get(
    owner.api,
    owner.cookie,
    `/stock/valuation?branchId=${ids.branch}`,
  );
  expect(status).toBe(200);
  const row = (id: string) => body.lines.find((line: any) => line.productId === id);
  expect(row(rice)).toMatchObject({
    onHandThousandths: 15_000,
    unitCost: 100_000,
    value: 1_500_000,
    flag: null,
  });
  expect(row(tomatoes)).toMatchObject({
    onHandThousandths: 2_500,
    unitCost: 280_000,
    value: 700_000,
    flag: null,
  });
  expect(row(rounding)).toMatchObject({ onHandThousandths: 333, unitCost: 10_001, value: 3_330 });
  expect(row(noCost)).toMatchObject({ unitCost: null, value: 0, flag: "no_cost" });
  expect(row(negative)).toMatchObject({ onHandThousandths: -1_000, value: 0, flag: "negative" });
  expect(body.total).toBe(2_203_330);
  expect(body.lines).toHaveLength(5);
});

test("An archived product with stock is still valued", async () => {
  const archived = ids.product;
  await databases()
    .db.update(product)
    .set({ archivedAt: new Date() })
    .where(eq(product.id, archived));
  await addDocument({
    kind: "receipt",
    supplierId: await addSupplier("Archive Supplies"),
    at: "08:00",
    lines: [{ productId: archived, quantity: 2_000, unitCost: 10_000 }],
  });
  const { body } = await get(owner.api, owner.cookie, `/stock/valuation?branchId=${ids.branch}`);
  expect(body.lines.find((line: any) => line.productId === archived)).toMatchObject({
    value: 20_000,
  });
  expect(body.total).toBe(2_223_330);
});

test("Valuation needs stock.read and a branch of the org", async () => {
  const cashier = await portalMember(owner, "cashier");
  expect((await get(owner.api, cashier, `/stock/valuation?branchId=${ids.branch}`)).status).toBe(
    403,
  );
  expect((await get(owner.api, null, `/stock/valuation?branchId=${ids.branch}`)).status).toBe(401);
  expect((await get(owner.api, owner.cookie, "/stock/valuation")).status).toBe(400);
  const foreign = await portalOwner(ids.otherOrg);
  expect(
    (await get(foreign.api, foreign.cookie, `/stock/valuation?branchId=${ids.branch}`)).status,
  ).toBe(404);
});
