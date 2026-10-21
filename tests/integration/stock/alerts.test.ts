import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { stockAlert } from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import { checkReorder } from "@shopper/core/stock";
import type { GoldenSale } from "../../fixtures/sales/golden/types";
import { ids } from "../../fixtures/sales/golden";
import { products } from "../../fixtures/sales/golden/references";
import { runGolden } from "../../support/sales/golden/run";
import { goldenWorld } from "../../support/sales/golden/setup";
import { postRefund, refundEvent } from "../../support/sales/refunds";
import { context, databases } from "../../support/till/server";
import { inventorySession, stockProduct } from "../../support/till/stock";
import { portalMember, portalOwner, type Portal } from "../../support/api/portal";
import { notifications, sentMessages } from "../../support/stock/queue";
import { addMovements, addSupplier, setLevel } from "../../support/stock/seed";
import { send } from "../../support/stock/http";
import { till } from "../../support/stock/till";
import { startTake } from "../../support/stock/takes";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let clerk: string;
let supplierId: string;
const rice = products.standard.id;
const cashSale = (name: string, product: "standard" | "zero"): GoldenSale => ({
  name,
  lines: [{ product }],
  tenders: [{ kind: "cash", amount: 200_000 }],
});
const level = (productId: string, levelThousandths: number | null) =>
  send(owner.api, clerk, "PUT", "/stock/reorder", {
    branchId: ids.branch,
    productId,
    levelThousandths,
  });
const receive = (productId: string, quantityThousandths: number) =>
  send(owner.api, clerk, "POST", "/stock/receipts", {
    id: v7(),
    branchId: ids.branch,
    supplierId,
    lines: [{ productId, quantityThousandths, unitCost: 95_000 }],
  });
const alerts = (productId: string) =>
  databases().db.select().from(stockAlert).where(eq(stockAlert.productId, productId));
const open = async (productId: string) => (await alerts(productId)).filter((row) => !row.clearedAt);
const openAlert = (productId: string, onHandThousandths: number) =>
  databases().db.insert(stockAlert).values({
    orgId: ids.org,
    branchId: ids.branch,
    productId,
    levelThousandths: 3_000,
    onHandThousandths,
  });
const messagesFor = async (productId: string) => {
  const rows = new Set((await alerts(productId)).map((row) => row.id));
  return (await sentMessages()).filter((m) => rows.has((m.payload as { alertId: string }).alertId));
};

beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  clerk = await portalMember(owner, "inventory");
  supplierId = await addSupplier("Alert Supplies");
});
afterAll(async () => world?.local.close());

test("Low-stock alert enqueued once, not once per sale", async () => {
  expect((await receive(rice, 5_000)).status).toBe(201);
  expect((await level(rice, 3_000)).status).toBe(200);
  expect(await messagesFor(rice)).toEqual([]);
  for (let sale = 1; sale <= 4; sale++)
    await runGolden(world, cashSale(`rice ${sale}`, "standard"));
  const sent = await messagesFor(rice);
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ type: "stock.low", v: 1, orgId: ids.org });
  expect(await open(rice)).toHaveLength(1);

  expect((await receive(rice, 10_000)).status).toBe(201);
  expect(await open(rice)).toHaveLength(0);
  expect(await messagesFor(rice)).toHaveLength(1);

  expect((await level(rice, 12_000)).status).toBe(200);
  expect(await messagesFor(rice)).toHaveLength(2);
  expect(await alerts(rice)).toHaveLength(2);
  expect(await open(rice)).toHaveLength(1);
});

type Row = {
  name: string;
  onHand: number;
  open?: boolean;
  act: (productId: string) => Promise<unknown>;
  raises: boolean;
};
const rows: Row[] = [
  {
    name: "till count",
    onHand: 4_000,
    raises: true,
    act: async (productId) =>
      till(
        {
          kind: "count",
          lines: [{ productId, countedThousandths: 2_000 }],
          countedAt: "2025-12-31T22:00:00.000Z",
        },
        await inventorySession(),
      ),
  },
  {
    name: "till receipt",
    onHand: 1_000,
    open: true,
    raises: false,
    act: async (productId) =>
      till(
        {
          kind: "receipt",
          lines: [{ productId, quantityThousandths: 5_000 }],
          receivedAt: "2025-12-31T22:00:00.000Z",
        },
        await inventorySession(),
      ),
  },
  {
    name: "wastage",
    onHand: 4_000,
    raises: true,
    act: (productId) =>
      send(owner.api, clerk, "POST", "/stock/adjustments", {
        id: v7(),
        branchId: ids.branch,
        cause: "damaged",
        lines: [{ productId, quantityThousandths: 2_000 }],
      }),
  },
  {
    name: "setting a level",
    onHand: 1_000,
    raises: true,
    act: (productId) => level(productId, 3_000),
  },
  {
    name: "deleting a level",
    onHand: 1_000,
    open: true,
    raises: false,
    act: (productId) => level(productId, null),
  },
  {
    name: "take post",
    onHand: 4_000,
    raises: true,
    act: async (productId) => (await startTake(owner, clerk, productId, 1_000))(),
  },
];

test("Every stock writer raises or clears the alert", async () => {
  for (const row of rows) {
    const productId = await stockProduct(row.onHand);
    // "Setting a level" starts with none; every other row has one in place, silently.
    if (row.name !== "setting a level") await setLevel(productId, 3_000);
    if (row.open) await openAlert(productId, row.onHand);
    const before = (await messagesFor(productId)).length;
    await row.act(productId);
    expect(await open(productId), row.name).toHaveLength(row.raises ? 1 : 0);
    expect((await messagesFor(productId)).length - before, row.name).toBe(
      row.raises && !row.open ? 1 : 0,
    );
  }

  // Sale and refund share a product: the sale takes it under its level, the refund lifts it back.
  const zero = products.zero.id;
  await addMovements([{ productId: zero, quantity: 2_000, at: "08:00" }]);
  await setLevel(zero, 1_500);
  const sale = (await runGolden(world, cashSale("zero for refund", "zero")))!;
  expect(await open(zero), "sale").toHaveLength(1);
  const refunded = await postRefund(
    refundEvent(world, sale, [{ line: 0, before: 0, after: 1_000 }], {
      tender: { kind: "cash" },
    }),
    world.session.proof,
  );
  expect(refunded.body.accepted).toBeDefined();
  expect(await open(zero), "refund").toHaveLength(0);
  expect((await messagesFor(zero)).length).toBe(1);
});

test("A take post that lifts stock clears the open alert and enqueues nothing", async () => {
  const productId = await stockProduct(1_000);
  await setLevel(productId, 3_000);
  await openAlert(productId, 1_000);
  const before = (await messagesFor(productId)).length;
  const post = await startTake(owner, clerk, productId, 5_000);
  expect((await post()).status).toBe(200);
  expect(await open(productId)).toHaveLength(0);
  expect((await messagesFor(productId)).length).toBe(before);
});

test("Posting a take twice raises nothing and enqueues nothing", async () => {
  const productId = await stockProduct(4_000);
  await setLevel(productId, 3_000);
  const post = await startTake(owner, clerk, productId, 5_000);
  expect((await post()).status).toBe(200);
  const sent = (await sentMessages()).length;
  const again = await post();
  expect(again.status).toBe(409);
  expect(again.body.code).toBe("TAKE_CLOSED");
  expect(await alerts(productId)).toEqual([]);
  expect((await sentMessages()).length).toBe(sent);
});

test("A rolled-back writer enqueues nothing", async () => {
  const productId = await stockProduct(1_000);
  await setLevel(productId, 3_000);
  const before = (await sentMessages()).length;
  const failing = defineCommand({
    name: "stock.test.rollback",
    async run(tx, ctx, input: { productId: string }) {
      await checkReorder(tx, ctx, ids.branch, [input.productId]);
      throw new Error("writer failed after raising the alert");
    },
    audit: () => ({}),
  });
  await expect(
    failing(databases().db, { ...context, orgId: ids.org, queue: notifications }, { productId }),
  ).rejects.toThrow("writer failed");
  expect(await alerts(productId)).toEqual([]);
  expect((await sentMessages()).length).toBe(before);
});
