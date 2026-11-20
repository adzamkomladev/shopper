// v1.5 Day 51: customers of an on-prem shop. Their accounts live in the relay org (phone sign-in there); for the
// customers staff opted in, the box publishes the receipts and points its own webapp code would show, so the online
// account reads the same as a cloud shop's. Nothing of an opted-out customer leaves the box.
//   POST /relay/customers { customers: [{ id, phone, name, points, receipts }], withdrawn: [id] }
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq, sql } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { readShopPoints } from "@shopper/core/shop";
import { goldenWorld } from "../../support/sales/golden/setup";
import { addCustomer, addLoyaltyEntry } from "../../support/customers/seed";
import { freshSale, pushSale, sameTillSale } from "../../support/customers/credit";
import { cashSaleEvent, pointsFold } from "../../support/customers/loyalty";
import { setOrg } from "../../support/customers/due";
import { ids } from "../../support/till/sales";
import { shopHttp } from "../../support/shop/http";
import { customersWorld } from "../../support/relay/customers";

const SHARED = "0277310001";
const PRIVATE = "0277310002";
let golden: Awaited<ReturnType<typeof goldenWorld>>;
let w: Awaited<ReturnType<typeof customersWorld>>;
let http: ReturnType<typeof shopHttp>;
let shared: string;
let privateOne: string;
let sharedSale: { id: string; receiptNumber: string | null };
let privateSale: { id: string; receiptNumber: string | null };

beforeAll(async () => {
  golden = await goldenWorld();
  await setOrg({ loyalty_enabled: true, loyalty_earn_bps: 100, loyalty_point_value: 100 });
  w = await customersWorld();
  http = shopHttp({ db: w.relayDb, queue: { send: async () => {} } as never });
  shared = await addCustomer({ phone: SHARED, name: "Ama Shared" });
  privateOne = await addCustomer({ phone: PRIVATE, name: "Kofi Private" });
  const first = await freshSale();
  expect((await pushSale(first, cashSaleEvent(first, shared))).body.accepted).toHaveLength(1);
  const second = await sameTillSale();
  expect((await pushSale(second, cashSaleEvent(second, privateOne))).body.accepted).toHaveLength(1);
  sharedSale = { id: first.event.sale.id, receiptNumber: first.event.sale.receiptNumber };
  privateSale = { id: second.event.sale.id, receiptNumber: second.event.sale.receiptNumber };
  await w.share(shared, true);
}, 180_000);
afterAll(async () => {
  http?.close();
  await w?.close();
  await golden?.local.close();
});

const customerBodies = () =>
  w.sent.filter((request) => request.path === "/relay/customers").map((request) => request.body);
const json = async (response: Response) => ({
  status: response.status,
  body: await response.json().catch(() => null),
});

test("an opted-out customer's receipts never leave the box", async () => {
  await w.run();
  const bodies = customerBodies().join("\n");
  expect(bodies).toContain(SHARED);
  expect(bodies).not.toContain(PRIVATE);
  expect(bodies).not.toContain(privateSale.id);
  expect(bodies).not.toContain(privateOne);
  const copied = await w.relayDb.select().from(schema.relayReceipt);
  expect(copied.map((row) => row.id)).toEqual([sharedSale.id]);
  expect(
    await w.relayDb.select({ phone: schema.relayCustomer.phone }).from(schema.relayCustomer),
  ).toEqual([{ phone: SHARED }]);
  // Nothing changed: the next run sends no customers at all.
  const before = customerBodies().length;
  await w.run();
  expect(customerBodies()).toHaveLength(before);
});

test("the loyalty balance in the webapp equals the box ledger, and follows it", async () => {
  await addLoyaltyEntry(shared, "earn", 40);
  await w.run();
  const cookie = await http.signIn(w.shop, "+233 27 731 0001");
  const online = await json(await http.request("/shop/account/points", { cookie }));
  expect(online.status).toBe(200);
  const boxView = await readShopPoints(w.box, { orgId: ids.org, phone: SHARED } as never);
  expect(online.body).toEqual(boxView);
  expect(online.body.points).toBe(await pointsFold(shared));
  expect(online.body.points).toBeGreaterThan(40);

  await addLoyaltyEntry(shared, "redeem", -10);
  await w.run();
  const after = await json(await http.request("/shop/account/points", { cookie }));
  expect(after.body.points).toBe(await pointsFold(shared));
});

test("the webapp lists and opens the box's receipts, and only the shopper's own", async () => {
  const cookie = await http.signIn(w.shop, "+233 27 731 0001");
  const list = await json(await http.request("/shop/account/receipts", { cookie }));
  expect(list.status).toBe(200);
  expect(list.body.items).toEqual([
    expect.objectContaining({
      id: sharedSale.id,
      receiptNumber: sharedSale.receiptNumber,
      status: "completed",
      total: expect.any(Number),
      branchName: expect.any(String),
      pdf: false,
    }),
  ]);
  const one = await json(await http.request(`/shop/account/receipts/${sharedSale.id}`, { cookie }));
  expect(one.status).toBe(200);
  expect(one.body.receipt.header.receiptNumber).toBe(sharedSale.receiptNumber);
  const other = await http.request(`/shop/account/receipts/${privateSale.id}`, { cookie });
  expect(other.status).toBe(404);
  const pdf = await http.request(`/shop/account/receipts/${sharedSale.id}/pdf`, { cookie });
  expect(pdf.status).toBe(404);
});

test("opting out withdraws the copy from the relay", async () => {
  await w.share(shared, false);
  await w.run();
  expect(customerBodies().at(-1)).toContain(shared);
  expect(await w.relayDb.select().from(schema.relayReceipt)).toEqual([]);
  expect(await w.relayDb.select().from(schema.relayCustomer)).toEqual([]);
  const cookie = await http.signIn(w.shop, "+233 27 731 0001");
  const points = await json(await http.request("/shop/account/points", { cookie }));
  expect(points.body.points).toBe(0);
  // Back on: published again whole.
  await w.share(shared, true);
  await w.run();
  expect(await w.relayDb.select({ id: schema.relayReceipt.id }).from(schema.relayReceipt)).toEqual([
    { id: sharedSale.id },
  ]);
});

test("a customer field outside the allowlist is refused and nothing is stored", async () => {
  const refused = await w.send("/relay/customers", {
    customers: [
      {
        id: privateOne,
        phone: PRIVATE,
        creditLimit: 100_000,
        points: { enabled: true, points: 0, tier: null, entries: [] },
        receipts: [],
      },
    ],
    withdrawn: [],
  });
  expect(refused.status).toBe(400);
  const [row] = await w.relayDb
    .execute(sql`SELECT count(*)::int AS n FROM relay_customer WHERE phone = ${PRIVATE}`)
    .then((result) => result.rows as { n: number }[]);
  expect(row!.n).toBe(0);
  expect(
    await w.relayDb
      .select()
      .from(schema.relayCustomer)
      .where(eq(schema.relayCustomer.id, privateOne)),
  ).toEqual([]);
});
