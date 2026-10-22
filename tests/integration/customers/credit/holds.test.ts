// Account holds on the till sync lane: create (replay by id), release, the one-hour count, settling a sale, the
// session gate and the account summary. A hold's id is the till's tender id; it is bound to one customer,
// device, cashier and amount.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { ids } from "../../../support/till/sales";
import { databases } from "../../../support/till/server";
import { memberWithPin } from "../../../support/sync/members";
import { addCustomer } from "../../../support/customers/seed";
import { uploader } from "../../../support/customers/till";
import {
  backdate,
  creditHolds,
  creditSaleEvent,
  freshSale,
  holdRows,
  pushSale,
  saleGross,
  saleRows,
  sameTillSale,
  secondDevice,
  sessionOf,
} from "../../../support/customers/credit";
import { entries } from "../../../support/customers/ledger";

let world: Awaited<ReturnType<typeof goldenWorld>>;
const holds = creditHolds();
beforeAll(async () => {
  world = await goldenWorld();
});
afterAll(async () => world?.local.close());

const limited = (phone: string, creditLimit = 1_000_000) => addCustomer({ creditLimit, phone });

test("a hold is created once: the same id and content replays as 200, other content under the id is 409", async () => {
  const customerId = await limited("0271710001");
  const session = await uploader();
  const id = v7();
  const first = await holds.create(session, customerId, 250_000, { id });
  expect(first.status).toBe(201);
  expect(first.body.hold).toMatchObject({
    id,
    customerId,
    kind: "credit",
    amount: 250_000,
    status: "held",
  });
  expect((await holds.create(session, customerId, 250_000, { id })).status).toBe(200);
  expect((await holds.create(session, customerId, 300_000, { id })).status).toBe(409);
  expect(await holdRows(customerId)).toMatchObject([{ id, status: "held", amount: 250_000 }]);
  expect((await holds.account(customerId)).body).toMatchObject({
    held: 250_000,
    available: 750_000,
  });
});

test("releasing a hold frees the credit, a repeated release is a no-op and a consumed hold cannot be released", async () => {
  const customerId = await limited("0271710002");
  const session = await uploader();
  const id = v7();
  await holds.create(session, customerId, 400_000, { id });
  expect((await holds.account(customerId)).body).toMatchObject({ held: 400_000 });

  expect((await holds.release(session, id)).status).toBe(200);
  expect(await holdRows(customerId)).toMatchObject([{ id, status: "released" }]);
  expect((await holds.account(customerId)).body).toMatchObject({ held: 0, available: 1_000_000 });
  // The till retries a release whose reply was lost.
  expect((await holds.release(session, id)).status).toBe(200);

  const spent = v7();
  await holds.create(session, customerId, 100_000, { id: spent });
  await databases().db.execute(
    sql`UPDATE account_hold SET status = 'consumed' WHERE id = ${spent}`,
  );
  expect((await holds.release(session, spent)).status).toBe(409);
  expect(await holdRows(customerId)).toMatchObject([
    { status: "released" },
    { status: "consumed" },
  ]);
  expect((await holds.release(session, v7())).status).toBe(404);
});

test("a hold older than an hour stops counting, yet an unconsumed old hold still settles its sale", async () => {
  const customerId = await limited("0271710003");
  // The golden catalogue's sale on a re-enrolled register; the hold's session comes from the same register.
  const created = await freshSale();
  const session = await uploader();
  const amount = saleGross(created);
  const id = v7();
  expect((await holds.create(session, customerId, amount, { id })).status).toBe(201);
  expect((await holds.account(customerId)).body).toMatchObject({
    held: amount,
    available: 1_000_000 - amount,
  });

  await backdate(id);
  expect((await holds.account(customerId)).body).toMatchObject({ held: 0, available: 1_000_000 });
  expect(await holdRows(customerId)).toMatchObject([{ id, status: "held" }]);

  const pushed = await pushSale(created, creditSaleEvent(created, customerId, id));
  expect(pushed.body).toMatchObject({
    accepted: [{ localId: created.event.sale.localId }],
    rejected: [],
  });
  expect(await entries(customerId)).toMatchObject([
    { kind: "charge", amount, sale_id: created.event.sale.id, hold_id: id },
  ]);
  expect(await holdRows(customerId)).toMatchObject([{ id, status: "consumed" }]);
});

test("a hold settles only the sale it was made for: its customer, device, amount, and once", async () => {
  const customerId = await limited("0271710004");
  const stranger = await limited("0271710005");
  const created = await freshSale();
  const session = await uploader();
  const other = await secondDevice();
  const amount = saleGross(created);
  const reject = async (event: unknown, why: string) => {
    const pushed = await pushSale(created, event);
    expect(pushed.body.rejected, why).toMatchObject([{ code: "INVALID_PAYMENT" }]);
    expect(await saleRows(created.event.sale.id), why).toEqual([]);
  };

  const wrongCustomer = v7();
  await holds.create(session, stranger, amount, { id: wrongCustomer });
  await reject(creditSaleEvent(created, customerId, wrongCustomer), "another customer's hold");

  const wrongDevice = v7();
  await creditHolds(other.headers).create(other.session, customerId, amount, { id: wrongDevice });
  await reject(creditSaleEvent(created, customerId, wrongDevice), "another register's hold");

  const wrongAmount = v7();
  await holds.create(session, customerId, amount + 10_000, { id: wrongAmount });
  await reject(creditSaleEvent(created, customerId, wrongAmount), "a hold of another amount");

  const released = v7();
  await holds.create(session, customerId, amount, { id: released });
  await holds.release(session, released);
  await reject(creditSaleEvent(created, customerId, released), "a released hold");

  const good = v7();
  await holds.create(session, customerId, amount, { id: good });
  expect(
    (await pushSale(created, creditSaleEvent(created, customerId, good))).body.rejected,
  ).toEqual([]);
  const again = await sameTillSale();
  const replay = await pushSale(again, creditSaleEvent(again, customerId, good));
  expect(replay.body.rejected).toMatchObject([{ code: "INVALID_PAYMENT" }]);
  expect(await entries(customerId)).toHaveLength(1);
});

test("a session without sale.create gets 403 and nothing is held; an unknown or foreign customer is 404", async () => {
  const customerId = await limited("0271710006");
  const keeper = await sessionOf(await memberWithPin("Stock Keeper", "inventory", "4455"), "4455");
  expect((await holds.create(keeper, customerId, 10_000)).status).toBe(403);
  expect(await holdRows(customerId)).toEqual([]);

  const session = await uploader();
  expect((await holds.create(session, v7(), 10_000)).status).toBe(404);
  const foreign = await addCustomer({ orgId: ids.otherOrg, creditLimit: 1_000_000 });
  expect((await holds.create(session, foreign, 10_000)).status).toBe(404);
  expect((await holds.account(foreign)).status).toBe(404);
  expect((await holds.account(v7())).status).toBe(404);
  expect(await holdRows(foreign)).toEqual([]);
});

test("the account summary carries exactly the limit, balance, held, available, eligibility and points fields", async () => {
  const customerId = await limited("0271710007", 500_000);
  await databases().db.execute(sql`
    INSERT INTO credit_entry (org_id, customer_id, kind, amount, actor_id, occurred_at)
    VALUES (${ids.org}, ${customerId}, 'charge', 120_000, ${ids.cashier}, now())`);
  await holds.create(await uploader(), customerId, 80_000);
  const summary = (await holds.account(customerId)).body;
  expect(Object.keys(summary).sort()).toEqual(
    [
      "available",
      "balance",
      "eligible",
      "held",
      "limit",
      "loyaltyEnabled",
      "pointValue",
      "points",
    ].sort(),
  );
  expect(summary).toMatchObject({
    limit: 500_000,
    balance: 120_000,
    held: 80_000,
    available: 300_000,
    eligible: true,
    points: 0,
    loyaltyEnabled: false,
  });
});
