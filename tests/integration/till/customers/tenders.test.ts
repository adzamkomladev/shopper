// On account at the till. Credit is online only: {type:"customer.account", customerId} reads what the customer may
// spend, and {type:"tender.account", expectedRevision, kind:"credit", amount} takes a server hold whose id becomes
// the tender id. Removing the tender or voiding the basket releases it; a basket holding one cannot be parked
// ({type:"error", code:"TENDER_ACTIVE"}); a release that never reaches the server leaves the hold to lapse.
import { afterAll, afterEach, beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { portalOwner } from "../../../support/api/portal";
import { customerApi } from "../../../support/customers/http";
import { startCounter } from "../../../support/customers/till";
import {
  UNIT,
  arrived,
  basketOf,
  creditSale,
  heldTender,
  holdPosts,
  onAccount,
  withManager,
} from "../../../support/customers/account";
import {
  backdate,
  creditHolds,
  holdRows,
  verifiedCustomer,
} from "../../../support/customers/credit";
import { entries } from "../../../support/customers/ledger";
import { ids } from "../../../support/till/sales";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let portal: ReturnType<typeof customerApi>;
let counter: Awaited<ReturnType<typeof startCounter>> | undefined;
const holds = creditHolds();
beforeAll(async () => {
  world = await goldenWorld();
  const owner = await portalOwner(ids.org, ids.cashier);
  portal = customerApi(owner, owner.cookie);
});
afterAll(async () => world?.local.close());
afterEach(async () => {
  await counter?.close();
  counter = undefined;
});

/** A register that has pulled a verified customer with `limit`, holding `units` of the first product for them. */
async function till(phone: string, limit: number, units = 1) {
  const customerId = await verifiedCustomer(portal, limit, { phone });
  counter = await startCounter();
  await counter.settle();
  await basketOf(counter, customerId, units);
  return { customerId, counter };
}
const draft = () => counter!.ask({ type: "readDraft" });

test("offline, the account is unreadable and an account tender is refused with OFFLINE_UNAVAILABLE, but cash still sells", async () => {
  const { customerId } = await till("0271750001", 100_000);
  counter!.upstream.setAvailable(false);
  expect(await counter!.ask({ type: "customer.account", customerId })).toMatchObject({
    type: "error",
    code: "OFFLINE_UNAVAILABLE",
  });
  expect(await onAccount(counter!, 2, UNIT)).toMatchObject({
    type: "error",
    code: "OFFLINE_UNAVAILABLE",
  });
  expect(await draft()).toMatchObject({ view: { draft: { revision: 2, tenders: [] } } });
  expect(await holdRows(customerId)).toEqual([]);

  const cash = await counter!.ask({
    type: "tender.add",
    expectedRevision: 2,
    kind: "cash",
    amount: UNIT,
  });
  expect(cash).toMatchObject({ kind: "draft" });
  expect(await counter!.ask({ type: "sale.complete", expectedRevision: 3 })).toMatchObject({
    type: "result",
    kind: "sale",
  });
});

test("online, the account answers what the customer may spend", async () => {
  const { customerId } = await till("0271750002", 100_000);
  expect(await counter!.ask({ type: "customer.account", customerId })).toMatchObject({
    type: "result",
    kind: "account",
    account: { limit: 100_000, balance: 0, held: 0, available: 100_000, eligible: true },
  });
});

test("an account tender takes a hold before the sale completes; the push settles it and charges the account", async () => {
  const customerId = await verifiedCustomer(portal, 100_000, { phone: "0271750003" });
  counter = await startCounter();
  await counter.settle();
  const sold = await creditSale(counter, customerId, { units: 1, credit: UNIT });
  expect(sold.sale.tenders).toMatchObject([{ id: sold.tenderId, kind: "credit", amount: UNIT }]);
  expect(sold.sale.customer).toMatchObject({ id: customerId });
  // The hold was taken at the tender, so it exists (and the server accepted it) before the sale was pushed.
  expect(holdPosts(counter)).toMatchObject([{ path: "/sync/customers/holds", status: 201 }]);
  expect(await holdRows(customerId)).toMatchObject([
    { id: sold.tenderId, status: "held", amount: UNIT },
  ]);
  expect((await holds.account(customerId)).body).toMatchObject({
    held: UNIT,
    available: 100_000 - UNIT,
  });

  await arrived(counter, sold.saleId);
  const order = counter.upstream.requests.map((r) => r.path);
  expect(order.indexOf("/sync/customers/holds")).toBeLessThan(order.indexOf("/sync/push"));
  expect(await holdRows(customerId)).toMatchObject([
    { id: sold.tenderId, status: "consumed", sale_id: sold.saleId },
  ]);
  expect(await entries(customerId)).toMatchObject([
    { kind: "charge", amount: UNIT, sale_id: sold.saleId, hold_id: sold.tenderId },
  ]);
  expect((await holds.account(customerId)).body).toMatchObject({ balance: UNIT, held: 0 });
});

test("removing the account tender releases the hold and frees the credit", async () => {
  const { customerId } = await till("0271750004", 100_000);
  const tenderId = await heldTender(counter!, 2, UNIT);
  expect(await holdRows(customerId)).toMatchObject([{ id: tenderId, status: "held" }]);

  const removed = await counter!.ask({ type: "tender.remove", expectedRevision: 3, tenderId });
  expect(removed).toMatchObject({ kind: "draft", view: { draft: { revision: 4, tenders: [] } } });
  expect(await holdRows(customerId)).toMatchObject([{ id: tenderId, status: "released" }]);
  expect((await holds.account(customerId)).body).toMatchObject({ held: 0, available: 100_000 });
  expect(holdPosts(counter!).map((r) => r.path)).toEqual([
    "/sync/customers/holds",
    `/sync/customers/holds/${tenderId}/release`,
  ]);
});

test("voiding the basket releases the account hold", async () => {
  const { customerId } = await till("0271750005", 100_000);
  const tenderId = await heldTender(counter!, 2, UNIT);
  const approval = await withManager(counter!);
  const voided = await counter!.ask({
    type: "sale.void",
    expectedRevision: 3,
    reason: "Customer left",
    approval,
  });
  expect(voided).toMatchObject({ kind: "draft", view: { draft: { status: "voided" } } });
  expect(await holdRows(customerId)).toMatchObject([{ id: tenderId, status: "released" }]);
  expect((await holds.account(customerId)).body).toMatchObject({ held: 0, available: 100_000 });
});

test("a basket holding an account tender cannot be parked, and can once the tender is removed", async () => {
  const { customerId } = await till("0271750006", 100_000);
  const tenderId = await heldTender(counter!, 2, UNIT);
  expect(await counter!.ask({ type: "sale.hold", expectedRevision: 3 })).toMatchObject({
    type: "error",
    code: "TENDER_ACTIVE",
  });
  expect(await draft()).toMatchObject({ view: { draft: { status: "open", revision: 3 } } });
  expect(await holdRows(customerId)).toMatchObject([{ id: tenderId, status: "held" }]);

  await counter!.ask({ type: "tender.remove", expectedRevision: 3, tenderId });
  expect(await counter!.ask({ type: "sale.hold", expectedRevision: 4 })).toMatchObject({
    kind: "draft",
    view: { draft: { status: "held" } },
  });
});

test("a release that never reaches the server still removes the tender, and the orphaned hold lapses after an hour", async () => {
  const { customerId } = await till("0271750007", 100_000);
  const tenderId = await heldTender(counter!, 2, UNIT);

  counter!.upstream.setAvailable(false);
  const removed = await counter!.ask({ type: "tender.remove", expectedRevision: 3, tenderId });
  expect(removed).toMatchObject({ kind: "draft", view: { draft: { tenders: [] } } });
  expect(await holdRows(customerId)).toMatchObject([{ id: tenderId, status: "held" }]);
  // Until it lapses it still counts against the customer.
  expect((await holds.account(customerId)).body).toMatchObject({
    held: UNIT,
    available: 100_000 - UNIT,
  });

  await backdate(tenderId);
  expect((await holds.account(customerId)).body).toMatchObject({ held: 0, available: 100_000 });
});

test("a tender beyond the limit, or for a customer with no limit and no deposit, is refused at the till and holds nothing", async () => {
  const { customerId } = await till("0271750008", 5_000);
  expect(await onAccount(counter!, 2, UNIT)).toMatchObject({ type: "error", code: "CREDIT_LIMIT" });
  expect(await draft()).toMatchObject({ view: { draft: { revision: 2, tenders: [] } } });
  expect(await holdRows(customerId)).toEqual([]);

  const plain = await portal.create({
    id: v7(),
    name: "No Limit",
    phone: "0271750009",
    kind: "individual",
  });
  expect(plain.status).toBe(201);
  await counter!.settle();
  await counter!.ask({ type: "customer.attach", expectedRevision: 2, customerId: plain.body.id });
  expect(await onAccount(counter!, 3, UNIT)).toMatchObject({ type: "error", code: "NOT_ELIGIBLE" });
  expect(await holdRows(plain.body.id)).toEqual([]);
});
