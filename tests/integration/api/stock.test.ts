import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { goldenWorld } from "../../support/sales/golden/setup";
import { products } from "../../fixtures/sales/golden/references";
import { ids } from "../../fixtures/sales/golden";
import { addDocument, addMovements, addSupplier, setLevel } from "../../support/stock/seed";
import { get, portalMember, portalOwner, type Portal } from "../../support/api/portal";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let document: string;
const rice = products.standard.id;
const branch = `branchId=${ids.branch}`;

beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  await addMovements([{ productId: rice, quantity: 8_000, at: "08:00" }]);
  await setLevel(rice, 9_000);
  document = await addDocument({
    kind: "receipt",
    supplierId: await addSupplier("Api Supplies"),
    at: "09:00",
    lines: [{ productId: rice, quantity: 1_000, unitCost: 100_000 }],
  });
});
afterAll(async () => {
  await world?.local.close();
});

const reads = () => [
  "/stock/branches",
  `/stock?${branch}`,
  `/stock/products/${rice}?${branch}`,
  `/stock/documents?${branch}`,
  `/stock/documents/${document}`,
];

test("the stock reads are 401 without a session", async () => {
  for (const path of reads()) {
    const anonymous = await get(owner.api, null, path);
    expect(anonymous.status, path).toBe(401);
    expect(anonymous.body).toEqual({ error: "Authentication required" });
  }
});

test("stock.read is data: the inventory manager reads, the cashier gets 403 on every route", async () => {
  const clerk = await portalMember(owner, "inventory");
  const cashier = await portalMember(owner, "cashier");
  for (const path of reads()) {
    expect((await get(owner.api, clerk, path)).status, path).toBe(200);
    const denied = await get(owner.api, cashier, path);
    expect(denied.status, path).toBe(403);
    expect(denied.body).toEqual({ error: "Permission denied" });
  }
});

test("the owner reads on hand, a product's movements and a record through the API", async () => {
  const list = await get(owner.api, owner.cookie, `/stock?${branch}&low=1`);
  expect(list.body.items).toEqual([
    expect.objectContaining({ productId: rice, onHandThousandths: 9_000, low: true }),
  ]);
  const detail = await get(owner.api, owner.cookie, `/stock/products/${rice}?${branch}`);
  expect(detail.body.movements[0]).toMatchObject({
    quantityThousandths: 1_000,
    balanceThousandths: 9_000,
  });
  const record = await get(owner.api, owner.cookie, `/stock/documents/${document}`);
  expect(record.body).toMatchObject({
    id: document,
    kind: "receipt",
    supplierName: "Api Supplies",
  });
  expect((await get(owner.api, owner.cookie, "/stock/branches")).body.branches).toEqual([
    expect.objectContaining({ id: ids.branch }),
  ]);
});

test("bad input is 400 and unknown or foreign records are 404", async () => {
  expect((await get(owner.api, owner.cookie, "/stock")).status).toBe(400);
  expect((await get(owner.api, owner.cookie, "/stock?branchId=nope")).status).toBe(400);
  expect((await get(owner.api, owner.cookie, `/stock?${branch}&limit=0`)).status).toBe(400);
  const missing = "019a0000-0000-7000-8000-0000000fffff";
  for (const path of [
    `/stock?branchId=${missing}`,
    `/stock/products/${ids.otherProduct}?${branch}`,
    `/stock/documents/${missing}`,
  ])
    expect((await get(owner.api, owner.cookie, path)).status, path).toBe(404);
  expect((await get(owner.api, owner.cookie, "/stock/documents/not-a-uuid")).status).toBe(400);
});

test("another org's owner sees no branches and gets 404 for these ids", async () => {
  const foreign = await portalOwner(ids.otherOrg);
  expect((await get(foreign.api, foreign.cookie, "/stock/branches")).body).toEqual({
    branches: [],
  });
  expect((await get(foreign.api, foreign.cookie, `/stock?${branch}`)).status).toBe(404);
  expect((await get(foreign.api, foreign.cookie, `/stock/documents/${document}`)).status).toBe(404);
});
