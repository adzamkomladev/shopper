import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { stockAlert } from "@shopper/db-pg";
import { ids } from "../../fixtures/sales/golden";
import { goldenWorld } from "../../support/sales/golden/setup";
import { databases } from "../../support/till/server";
import { stockProduct } from "../../support/till/stock";
import { portalMember, portalOwner, type Portal } from "../../support/api/portal";
import { sentMessages } from "../../support/stock/queue";
import { addSupplier, setLevel } from "../../support/stock/seed";
import { send } from "../../support/stock/http";

// Two registers that sold the last unit offline leave on hand under zero; wastage gets there the same way.
let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let clerk: string;
let supplierId: string;
const receive = (productId: string, quantityThousandths: number) =>
  send(owner.api, clerk, "POST", "/stock/receipts", {
    id: v7(),
    branchId: ids.branch,
    supplierId,
    lines: [{ productId, quantityThousandths, unitCost: 95_000 }],
  });
const waste = (productId: string, quantityThousandths: number) =>
  send(owner.api, clerk, "POST", "/stock/adjustments", {
    id: v7(),
    branchId: ids.branch,
    cause: "damaged",
    lines: [{ productId, quantityThousandths }],
  });
const alerts = (productId: string) =>
  databases().db.select().from(stockAlert).where(eq(stockAlert.productId, productId));
const open = async (productId: string) => (await alerts(productId)).filter((row) => !row.clearedAt);
const messagesFor = async (productId: string) => {
  const rows = new Set((await alerts(productId)).map((row) => row.id));
  return (await sentMessages()).filter((m) => rows.has((m.payload as { alertId: string }).alertId));
};

beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  clerk = await portalMember(owner, "inventory");
  supplierId = await addSupplier("Negative Supplies");
});
afterAll(async () => world?.local.close());

test("Stock written past zero raises one negative alert without a reorder point, clears on a delivery and raises again once", async () => {
  const productId = await stockProduct(1_000);
  const negative = async () => (await open(productId)).filter((row) => row.kind === "negative");

  expect((await waste(productId, 2_000)).status).toBe(201);
  expect(await open(productId)).toMatchObject([
    { kind: "negative", onHandThousandths: -1_000, levelThousandths: 0 },
  ]);
  expect((await waste(productId, 1_000)).status).toBe(201);
  expect(await negative()).toHaveLength(1);
  const sent = await messagesFor(productId);
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ type: "stock.negative", v: 1, orgId: ids.org });

  expect((await receive(productId, 5_000)).status).toBe(201);
  expect(await open(productId)).toEqual([]);
  expect((await waste(productId, 4_000)).status).toBe(201);
  expect(await negative()).toHaveLength(1);
  expect(await messagesFor(productId)).toHaveLength(2);
  expect(await alerts(productId)).toHaveLength(2);
});

test("A low alert turns negative in place, texts again, and goes back to low once stock is above zero", async () => {
  const productId = await stockProduct(4_000);
  await setLevel(productId, 3_000);
  expect((await waste(productId, 2_000)).status).toBe(201);
  expect(await open(productId)).toMatchObject([{ kind: "low" }]);
  expect((await waste(productId, 3_000)).status).toBe(201);
  const [negative] = await open(productId);
  expect(negative).toMatchObject({ kind: "negative", onHandThousandths: -1_000, sentAt: null });
  expect((await receive(productId, 2_000)).status).toBe(201);
  expect(await open(productId)).toMatchObject([{ id: negative!.id, kind: "low" }]);
  expect((await messagesFor(productId)).map((m) => m.type)).toEqual([
    "stock.low",
    "stock.negative",
    "stock.low",
  ]);
});
