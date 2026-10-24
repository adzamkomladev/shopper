// What the back office reads about one customer beyond the account: when identity was verified, the last visit, the
// purchases, the statements sent, the tier they move down from, and who owes what across the shop.
//   GET /customers/:id            -> kycVerifiedAt and lastVisitAt
//   GET /customers?onAccount=1    -> only customers who owe
//   GET /customers/:id/sales      -> their sales, newest first (customer.read)
//   GET /customers/:id/statements -> the statements sent to them, newest first (customer.read)
//   GET /customers/:id/loyalty    -> `projection`: the tier they lose and when, or null
//   GET /customers/ageing         -> every customer who owes, aged, as JSON (what the CSV holds)
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import { goldenWorld } from "../../support/sales/golden/setup";
import { portalMember, portalOwner, type Portal } from "../../support/api/portal";
import { addCustomer } from "../../support/customers/seed";
import { addEntryAt } from "../../support/customers/ledger";
import { freshSale, pushSale } from "../../support/customers/credit";
import { ON, cashSaleEvent, loyaltyApi } from "../../support/customers/loyalty";
import { customerApi } from "../../support/customers/http";
import { saleAt } from "../../support/customers/due";
import { statementApi } from "../../support/customers/statements";
import { ids } from "../../support/till/sales";
import { databases } from "../../support/till/server";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let admin: ReturnType<typeof customerApi>;
let loyalty: ReturnType<typeof loyaltyApi>;
let statements: ReturnType<typeof statementApi>;
let inventoryCookie: string;

beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  admin = customerApi(owner, owner.cookie);
  loyalty = loyaltyApi(owner, owner.cookie);
  statements = statementApi(owner, owner.cookie);
  inventoryCookie = await portalMember(owner, "inventory");
  // saleAt copies the till, store and session of a recorded sale.
  const template = await freshSale();
  const seeder = await addCustomer({ phone: "0271801000" });
  expect((await pushSale(template, cashSaleEvent(template, seeder))).body.accepted).toHaveLength(1);
});
afterAll(async () => world?.local.close());

async function read(path: string, cookie = owner.cookie) {
  const response = await owner.api.request(path, { headers: { cookie } });
  return { status: response.status, body: await response.json().catch(() => null) };
}

test("a customer says when identity was verified and when they last bought", async () => {
  const plain = await addCustomer({ phone: "0271801001" });
  const verified = await addCustomer({ phone: "0271801002", creditLimit: 500_000 });
  await saleAt(verified, 120_000, "2026-09-01T10:00:00Z");
  await saleAt(verified, 80_000, "2026-10-02T11:30:00Z");

  expect((await admin.read(plain)).body).toMatchObject({ kycVerifiedAt: null, lastVisitAt: null });
  const one = (await admin.read(verified)).body;
  expect(one.kycVerifiedAt).toEqual(expect.any(String));
  expect(one.lastVisitAt).toBe("2026-10-02T11:30:00.000Z");
  const listed = (await admin.list("q=0271801002")).body.items[0];
  expect(listed).toMatchObject({ id: verified, lastVisitAt: "2026-10-02T11:30:00.000Z" });
});

test("onAccount lists only the customers who owe", async () => {
  const owes = await addCustomer({ phone: "0271802001" });
  const settled = await addCustomer({ phone: "0271802002" });
  const deposit = await addCustomer({ phone: "0271802003" });
  await addEntryAt(owes, "charge", 250_000, "2026-10-01T09:00:00Z");
  await addEntryAt(settled, "charge", 100_000, "2026-10-01T09:00:00Z");
  await addEntryAt(settled, "payment", -100_000, "2026-10-02T09:00:00Z");
  await addEntryAt(deposit, "payment", -50_000, "2026-10-02T09:00:00Z");

  const listed = (await admin.list("onAccount=1&limit=100")).body.items.map((c: any) => c.id);
  expect(listed).toContain(owes);
  expect(listed).not.toContain(settled);
  expect(listed).not.toContain(deposit);
  expect((await admin.list("onAccount=yes")).status).toBe(400);
});

test("sales of a customer come newest first, only theirs, for anyone who may read customers", async () => {
  const buyer = await addCustomer({ phone: "0271803001" });
  const other = await addCustomer({ phone: "0271803002" });
  const first = await saleAt(buyer, 120_000, "2026-09-01T10:00:00Z");
  const second = await saleAt(buyer, 80_000, "2026-10-02T11:30:00Z");
  await saleAt(other, 999_000, "2026-10-03T11:30:00Z");

  const sales = await read(`/customers/${buyer}/sales`);
  expect(sales.status).toBe(200);
  expect(sales.body.items).toMatchObject([
    { id: second, total: 80_000, occurredAt: "2026-10-02T11:30:00.000Z", status: "completed" },
    { id: first, total: 120_000, occurredAt: "2026-09-01T10:00:00.000Z" },
  ]);
  expect((await read(`/customers/${other}/sales`)).body.items).toHaveLength(1);
  expect((await read(`/customers/${v7()}/sales`)).status).toBe(404);
  expect((await read(`/customers/${buyer}/sales`, inventoryCookie)).status).toBe(403);
});

test("statements sent are listed with their channel and status", async () => {
  const customerId = await addCustomer({ phone: "0271804001" });
  await admin.patch(customerId, { email: "ama@example.com" });
  await addEntryAt(customerId, "charge", 200_000, "2026-10-05T09:00:00Z");
  const period = { from: "2026-10-01", to: "2026-10-31" };
  expect((await statements.send(customerId, { channel: "sms", ...period })).status).toBe(201);
  expect((await statements.send(customerId, { channel: "email", ...period })).status).toBe(201);

  const sent = await read(`/customers/${customerId}/statements`);
  expect(sent.status).toBe(200);
  expect(sent.body.items.map((d: any) => d.channel).sort()).toEqual(["email", "sms"]);
  expect(sent.body.items[0]).toMatchObject({
    from: "2026-10-01",
    to: "2026-10-31",
    status: "queued",
  });
  expect(sent.body.items[0].createdAt).toEqual(expect.any(String));
  expect((await read(`/customers/${v7()}/statements`)).status).toBe(404);
  expect((await read(`/customers/${customerId}/statements`, inventoryCookie)).status).toBe(403);
});

test("loyalty names the tier a customer loses and the day, or null", async () => {
  expect((await loyalty.setSettings(ON)).status).toBe(200);
  await databases().db.execute(sql`
    INSERT INTO loyalty_tier (org_id, name, min_spend, earn_bps) VALUES
      (${ids.org}, 'Gold', 10000000, 300), (${ids.org}, 'Silver', 5000000, 200)`);
  const customerId = await addCustomer({ phone: "0271805001" });
  expect((await loyalty.history(customerId)).body.projection).toBeNull();
  await saleAt(customerId, 5_000_000, new Date(Date.now() - 100 * 86_400_000).toISOString());
  await saleAt(customerId, 5_000_000, new Date(Date.now() - 10 * 86_400_000).toISOString());

  const { projection, tier } = (await loyalty.history(customerId)).body;
  expect(tier).toMatchObject({ name: "Gold" });
  expect(projection).toMatchObject({ from: "Gold", to: "Silver" });
  expect(Date.parse(projection.on)).toBeGreaterThan(Date.now());
});

test("ageing across the shop lists each customer who owes, aged", async () => {
  const late = await addCustomer({ name: "Late Payer", phone: "0271806001" });
  const current = await addCustomer({ name: "Current Payer", phone: "0271806002" });
  const clear = await addCustomer({ name: "Clear Payer", phone: "0271806003" });
  const old = new Date(Date.now() - 80 * 86_400_000).toISOString();
  await addEntryAt(late, "charge", 300_000, old);
  await addEntryAt(current, "charge", 100_000, new Date().toISOString());
  await addEntryAt(clear, "charge", 100_000, old);
  await addEntryAt(clear, "payment", -100_000, new Date().toISOString());

  const ageing = await read("/customers/ageing");
  expect(ageing.status).toBe(200);
  const rows = ageing.body.items as {
    id: string;
    buckets: Record<string, number>;
    total: number;
  }[];
  expect(rows.find((r) => r.id === clear)).toBeUndefined();
  expect(rows.find((r) => r.id === current)).toMatchObject({
    total: 100_000,
    buckets: { current: 100_000 },
  });
  expect(rows.find((r) => r.id === late)).toMatchObject({
    total: 300_000,
    buckets: { "31-60": 300_000 },
  });
  expect((await read("/customers/ageing", inventoryCookie)).status).toBe(403);
});
