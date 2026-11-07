// Day 35: the transactions explorer lists paid online orders beside till sales. Order A (GHS 87.75 by card) is picked
// one oil short, replaced by palm oil at 25.00, and ends at 82.75 with a partial refund; B is paid and untouched; C is placed but never paid.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { finishStoreOrder, recordPick } from "@shopper/core/orders";
import { listTransactions, transactionsTable } from "@shopper/core/transactions";
import { fulfilWorld } from "../../support/orders/fulfil";
import { pickHelpers } from "../../support/orders/pick";

let f: Awaited<ReturnType<typeof fulfilWorld>>;
let a: { id: string };
let b: { id: string };
let c: { id: string };
const today = new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  f = await fulfilWorld({ acceptWithinMs: 30_000, pickLeadMs: 0 });
  const picked = await pickHelpers(f).accepted();
  a = picked.order;
  await recordPick(f.world.db, f.ctx, {
    id: a.id,
    lineId: picked.oil.id,
    pickedThousandths: 1_000,
    substitute: { productId: f.substitutes.palm, quantityThousandths: 1_000 },
  });
  await recordPick(f.world.db, f.ctx, {
    id: a.id,
    lineId: picked.rice.id,
    pickedThousandths: 1_500,
  });
  await finishStoreOrder(f.world.db, f.ctx, f.flows, a.id);
  b = await f.paid({ name: "Kofi Boateng", phone: "0209876543" });
  c = await f.place();
}, 180_000);
afterAll(async () => {
  await f?.close();
});

const list = (query: Record<string, string> = {}, scope?: string[]) =>
  listTransactions(f.world.db, f.world.a.orgId, { from: today, to: today, ...query }, scope);
const ids = async (query: Record<string, string> = {}, scope?: string[]) =>
  (await list(query, scope)).rows.map((row) => row.id).sort();

test("paid online orders are listed as orders of the online shop, refunded once any refund exists", async () => {
  const body = await list();
  expect(body.rows.map((row) => row.id).sort()).toEqual([a.id, b.id].sort());
  const row = body.rows.find((found) => found.id === a.id)!;
  const receipt = (await f.row(a)).receiptNumber;
  expect(row).toMatchObject({
    kind: "order",
    receiptNumber: receipt,
    cashierId: null,
    cashierName: "Online shop",
    customerName: "Ama Mensah",
    total: 827_500,
    status: "refunded",
    tenders: ["card"],
    items: 2,
  });
  expect(body.rows.find((found) => found.id === b.id)).toMatchObject({
    status: "completed",
    total: 877_500,
  });
  expect(body.counts).toMatchObject({ all: 2, completed: 1, refunded: 1, pending: 0 });
  expect(body.rows.map((found) => found.id)).not.toContain(c.id);
});

test("search finds an order by receipt number, phone or name; filters and branch scope narrow it", async () => {
  const receipt = (await f.row(b)).receiptNumber!;
  expect(await ids({ q: receipt })).toEqual([b.id]);
  expect(await ids({ q: "0209876543" })).toEqual([b.id]);
  expect(await ids({ q: "Boateng" })).toEqual([b.id]);
  expect(await ids({ tender: "card" })).toEqual([a.id, b.id].sort());
  expect(await ids({ tender: "cash" })).toEqual([]);
  expect(await ids({ cashierId: crypto.randomUUID() })).toEqual([]);
  expect(await ids({ status: "completed" })).toEqual([b.id]);
  expect(await ids({}, [f.shop.branches[1]!])).toEqual([]);
  expect(await ids({ branchId: f.shop.branches[0]! })).toEqual([a.id, b.id].sort());
});

test("the CSV holds the orders with the online shop as cashier", async () => {
  const table = await transactionsTable(f.world.db, f.world.a.orgId, { from: today, to: today });
  expect(table.rows).toHaveLength(2);
  expect(table.rows.map((row) => row[6])).toEqual([
    { kind: "text", value: "Online shop" },
    { kind: "text", value: "Online shop" },
  ]);
});
