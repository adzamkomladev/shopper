import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { stockDocument, stockMovement } from "@shopper/db-pg";
import { lastCosts } from "@shopper/core/stock";
import { goldenWorld } from "../../support/sales/golden/setup";
import { products } from "../../fixtures/sales/golden/references";
import { ids } from "../../fixtures/sales/golden";
import { databases } from "../../support/till/server";
import { get, portalMember, portalOwner, type Portal } from "../../support/api/portal";
import { addDocument, addSupplier } from "../../support/stock/seed";
import { send } from "../../support/stock/http";

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
  supplierId = await addSupplier("Receiving Supplies");
});
afterAll(async () => {
  await world?.local.close();
});

const receipt = (over: Record<string, unknown> = {}) => ({
  id: v7(),
  branchId: ids.branch,
  supplierId,
  lines: [
    { productId: rice, quantityThousandths: 24_000, unitCost: 95_000 },
    { productId: tomatoes, quantityThousandths: 10_500, unitCost: 280_000 },
  ],
  ...over,
});
const post = (body: unknown, cookie = clerk) =>
  send(owner.api, cookie, "POST", "/stock/receipts", body);

test("The inventory manager receives goods from a supplier with cost, dated by the server", async () => {
  const body = receipt({ reference: "GRN-1" });
  const before = Date.now();
  const response = await post(body);
  expect(response.status).toBe(201);
  expect(response.body).toMatchObject({
    id: body.id,
    kind: "receipt",
    supplierName: "Receiving Supplies",
    lineCount: 2,
  });
  expect(response.body.lines).toEqual([
    expect.objectContaining({ productId: rice, quantityThousandths: 24_000, unitCost: 95_000 }),
    expect.objectContaining({
      productId: tomatoes,
      quantityThousandths: 10_500,
      unitCost: 280_000,
    }),
  ]);
  const at = Date.parse(response.body.occurredAt);
  expect(at).toBeGreaterThanOrEqual(before);
  expect(at).toBeLessThanOrEqual(Date.now());
  const [saved] = await databases()
    .db.select()
    .from(stockDocument)
    .where(eq(stockDocument.id, body.id));
  expect(saved).toMatchObject({ deviceId: null, supplierId, kind: "receipt" });
  const stock = await get(owner.api, clerk, `/stock/products/${rice}?branchId=${ids.branch}`);
  expect(stock.body.movements[0]).toMatchObject({ reason: "receipt", unitCost: 95_000 });
});

test("A replay by id answers 200 without doubling stock; the same id with other content is 409", async () => {
  const body = receipt({ lines: [{ productId: rice, quantityThousandths: 1_000, unitCost: 1 }] });
  expect((await post(body)).status).toBe(201);
  const again = await post(body);
  expect(again.status).toBe(200);
  expect(again.body.id).toBe(body.id);
  const moves = await databases()
    .db.select()
    .from(stockMovement)
    .where(eq(stockMovement.documentId, body.id));
  expect(moves).toHaveLength(1);
  const changed = await post({
    ...body,
    lines: [{ productId: rice, quantityThousandths: 2_000, unitCost: 1 }],
  });
  expect(changed.status).toBe(409);
});

test("Bad receipts are rejected: no supplier, no lines, zero quantity, negative cost, repeated product", async () => {
  const line = { productId: rice, quantityThousandths: 1_000, unitCost: 1 };
  const bad = [
    receipt({ supplierId: undefined }),
    receipt({ lines: [] }),
    receipt({ lines: [{ ...line, quantityThousandths: 0 }] }),
    receipt({ lines: [{ ...line, unitCost: -1 }] }),
    receipt({ lines: [line, line] }),
    receipt({ lines: [{ ...line, unitCost: 1.5 }] }),
  ];
  for (const body of bad) expect((await post(body)).status, JSON.stringify(body)).toBe(400);
  const stranger = await addSupplier("Not ours", ids.otherOrg);
  expect((await post(receipt({ supplierId: stranger }))).status).toBe(400);
  expect((await post(receipt({ supplierId: v7() }))).status).toBe(400);
  expect((await post(receipt({ branchId: v7() }))).status).toBe(400);
  expect((await post(receipt({ lines: [{ ...line, productId: ids.otherProduct }] }))).status).toBe(
    400,
  );
});

test("The last costed receipt sets the unit cost; a cost-less till receipt leaves it alone", async () => {
  const product = products.zero.id;
  const costed = (at: string, unitCost: number) =>
    addDocument({
      kind: "receipt",
      supplierId,
      at,
      lines: [{ productId: product, quantity: 1_000, unitCost }],
    });
  await costed("09:00", 50_000);
  await costed("10:00", 60_000);
  await addDocument({
    kind: "receipt",
    at: "11:00",
    deviceId: world.scope.deviceId,
    lines: [{ productId: product, quantity: 1_000 }],
  });
  const costs = await lastCosts(databases().db, ids.org, ids.branch);
  expect(costs.get(product)).toBe(60_000);
  expect(costs.has(products.exempt.id)).toBe(false);
});

test("stock.write is data: inventory writes, the cashier and the accountant get 403", async () => {
  for (const role of ["cashier", "accountant"]) {
    const denied = await post(receipt(), await portalMember(owner, role));
    expect(denied.status, role).toBe(403);
  }
  const anonymous = await owner.api.request("/stock/receipts", { method: "POST", body: "{}" });
  expect(anonymous.status).toBe(401);
  const [none] = await databases()
    .db.select()
    .from(stockDocument)
    .where(and(eq(stockDocument.orgId, ids.org), eq(stockDocument.kind, "adjustment")));
  expect(none).toBeUndefined();
});

test("suppliers are written with stock.write, not product.write", async () => {
  const accountant = await portalMember(owner, "accountant");
  expect((await send(owner.api, accountant, "POST", "/suppliers", { name: "No" })).status).toBe(
    403,
  );
  expect(
    (await send(owner.api, clerk, "POST", "/suppliers", { name: "Inline supplier" })).status,
  ).toBe(201);
  expect((await get(owner.api, accountant, "/suppliers")).status).toBe(200);
});
