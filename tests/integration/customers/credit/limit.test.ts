// "Credit sale over limit refused" (Notion). An account tender is online only: the till takes a server hold first
// (POST /sync/customers/holds, 409 CREDIT_LIMIT / NOT_ELIGIBLE when it does not fit), and the sale it completes
// consumes that hold. A sale event that names no hold is forged and is rejected INVALID_PAYMENT.
import { afterAll, afterEach, beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { portalOwner } from "../../../support/api/portal";
import { customerApi } from "../../../support/customers/http";
import { addCustomer } from "../../../support/customers/seed";
import { startCounter, uploader } from "../../../support/customers/till";
import { arrived, basketOf, creditSale, onAccount } from "../../../support/customers/account";
import {
  creditHolds,
  creditSaleEvent,
  freshSale,
  holdRows,
  pushSale,
  saleRows,
  secondDevice,
  verifiedCustomer,
} from "../../../support/customers/credit";
import { chainValid, creditApi, entries } from "../../../support/customers/ledger";
import { ids } from "../../../support/till/sales";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let portal: ReturnType<typeof customerApi>;
let credit: ReturnType<typeof creditApi>;
let counter: Awaited<ReturnType<typeof startCounter>> | undefined;
const holds = creditHolds();
beforeAll(async () => {
  world = await goldenWorld();
  const owner = await portalOwner(ids.org, ids.cashier);
  portal = customerApi(owner, owner.cookie);
  credit = creditApi(owner, owner.cookie);
});
afterAll(async () => world?.local.close());
afterEach(async () => {
  await counter?.close();
  counter = undefined;
});

test("Credit sale over limit refused", async () => {
  const customerId = await verifiedCustomer(portal, 1_000_000, { phone: "0271700001" });
  counter = await startCounter();
  await counter.settle();

  // GH₵80 of a GH₵120 basket on account (GH₵40 cash) fits a GH₵100 limit and is accepted.
  const sold = await creditSale(counter, customerId, {
    units: 100,
    credit: 800_000,
    cash: 400_000,
  });
  expect(sold.sale.tenders).toMatchObject([
    { id: sold.tenderId, kind: "credit", amount: 800_000 },
    { kind: "cash", amount: 400_000 },
  ]);
  await arrived(counter, sold.saleId);
  expect(await entries(customerId)).toMatchObject([
    { kind: "charge", amount: 800_000, sale_id: sold.saleId, hold_id: sold.tenderId },
  ]);
  expect(await saleRows(sold.saleId)).toMatchObject([
    { customer_id: customerId, kind: "credit", amount: 800_000, hold_id: sold.tenderId },
    { customer_id: customerId, kind: "cash", amount: 400_000, hold_id: null },
  ]);
  expect(await holdRows(customerId)).toMatchObject([
    { id: sold.tenderId, status: "consumed", amount: 800_000, sale_id: sold.saleId },
  ]);
  expect((await holds.account(customerId)).body).toMatchObject({
    limit: 1_000_000,
    balance: 800_000,
    held: 0,
    available: 200_000,
    eligible: true,
  });

  // GH₵30 more does not fit: the till is refused at the tender and holds nothing.
  await basketOf(counter, customerId, 25);
  expect(await onAccount(counter, 2, 300_000)).toMatchObject({
    type: "error",
    code: "CREDIT_LIMIT",
  });
  expect(await counter.ask({ type: "readDraft" })).toMatchObject({
    view: { draft: { revision: 2, tenders: [] } },
  });

  // The server says the same to any caller: 409 with what is left.
  const session = await uploader();
  const refused = await holds.create(session, customerId, 300_000);
  expect(refused).toMatchObject({
    status: 409,
    body: { code: "CREDIT_LIMIT", available: 200_000 },
  });
  expect(await holdRows(customerId)).toHaveLength(1);
  expect(await entries(customerId)).toHaveLength(1);

  // The last GH₵20 fits exactly, then nothing is left.
  expect((await holds.create(session, customerId, 200_000)).status).toBe(201);
  expect((await holds.account(customerId)).body).toMatchObject({ held: 200_000, available: 0 });
  expect((await holds.create(session, customerId, 10_000)).status).toBe(409);
});

test("Credit sale over limit refused: a sale event with a credit tender and no hold is rejected as forged", async () => {
  const customerId = await addCustomer({ creditLimit: 1_000_000, phone: "0271700002" });
  const created = await freshSale();
  const forged = creditSaleEvent(created, customerId, v7());
  const pushed = await pushSale(created, forged);
  expect(pushed.status).toBe(200);
  expect(pushed.body.accepted).toEqual([]);
  expect(pushed.body.rejected).toMatchObject([
    { localId: created.event.sale.localId, code: "INVALID_PAYMENT" },
  ]);
  expect(await saleRows(created.event.sale.id)).toEqual([]);
  expect(await entries(customerId)).toEqual([]);
  expect(await holdRows(customerId)).toEqual([]);
  expect(await chainValid()).toBe(true);
});

test("Credit sale over limit refused: two GH₵60 holds from two devices leave exactly one", async () => {
  const other = await secondDevice();
  const first = creditHolds();
  const second = creditHolds(other.headers);
  const session = await uploader();
  // Without the row lock on the customer both read "nothing held" and both win, so race several customers.
  for (let round = 0; round < 5; round++) {
    const customerId = await addCustomer({ creditLimit: 1_000_000, phone: `027170010${round}` });
    const [a, b] = await Promise.all([
      first.create(session, customerId, 600_000),
      second.create(other.session, customerId, 600_000),
    ]);
    expect(
      [a.status, b.status].sort((x, y) => x - y),
      `round ${round}`,
    ).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body).toMatchObject({ code: "CREDIT_LIMIT", available: 400_000 });
    expect(await holdRows(customerId)).toHaveLength(1);
    expect((await first.account(customerId)).body).toMatchObject({
      held: 600_000,
      available: 400_000,
    });
  }
});

test("Credit sale over limit refused: a customer with no limit and no deposit is not eligible", async () => {
  const customerId = await addCustomer({ phone: "0271700003" });
  expect((await holds.account(customerId)).body).toMatchObject({
    limit: 0,
    balance: 0,
    available: 0,
    eligible: false,
  });
  const refused = await holds.create(await uploader(), customerId, 10_000);
  expect(refused).toMatchObject({ status: 409, body: { code: "NOT_ELIGIBLE" } });
  expect(await holdRows(customerId)).toEqual([]);
});

test("Credit sale over limit refused: a GH₵50 deposit lets an unverified customer spend GH₵50 on account, not GH₵51", async () => {
  const customerId = await addCustomer({ phone: "0271700004" });
  const deposit = await credit.pay(customerId, { id: v7(), amount: 500_000, method: "cash" });
  expect(deposit.status).toBe(201);
  expect((await holds.account(customerId)).body).toMatchObject({
    limit: 0,
    balance: -500_000,
    held: 0,
    available: 500_000,
    eligible: true,
  });
  const session = await uploader();
  const over = await holds.create(session, customerId, 510_000);
  expect(over).toMatchObject({ status: 409, body: { code: "CREDIT_LIMIT", available: 500_000 } });
  expect((await holds.create(session, customerId, 500_000)).status).toBe(201);
  expect((await holds.account(customerId)).body).toMatchObject({ held: 500_000, available: 0 });
});
