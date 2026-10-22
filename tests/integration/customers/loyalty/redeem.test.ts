// Redeeming points is a tender, online only, and works like credit: a server hold under the tender's id before the sale
// completes (`POST /sync/customers/holds` with kind "loyalty" and whole `points`), consumed into a `redeem` entry when the
// sale is accepted. The hold carries the point value of the moment (1 point = 100 units here). POINTS_SHORT counts the
// points other holds have set aside; LOYALTY_OFF while the org has it off. A refund hands redeemed points back first.
import { afterAll, afterEach, beforeAll, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { portalOwner, type Portal } from "../../../support/api/portal";
import { customerApi } from "../../../support/customers/http";
import { addCustomer, addLoyaltyEntry, holdStatuses } from "../../../support/customers/seed";
import { freshSale, holdRows, pushSale, sameTillSale } from "../../../support/customers/credit";
import { startCounter, uploader } from "../../../support/customers/till";
import { arrived } from "../../../support/customers/account";
import { report } from "../../../support/customers/payment";
import {
  ON,
  customerSale,
  loyaltyApi,
  loyaltyHolds,
  pointEntries,
  pointsSaleEvent,
} from "../../../support/customers/loyalty";
import { ids } from "../../../support/till/sales";
import { databases } from "../../../support/till/server";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let admin: ReturnType<typeof loyaltyApi>;
let portal: ReturnType<typeof customerApi>;
let counter: Awaited<ReturnType<typeof startCounter>> | undefined;
const holds = loyaltyHolds();
beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  admin = loyaltyApi(owner, owner.cookie);
  portal = customerApi(owner, owner.cookie);
  expect((await admin.setSettings(ON)).status).toBe(200);
});
afterAll(async () => world?.local.close());
afterEach(async () => {
  await counter?.close();
  counter = undefined;
});

const withPoints = async (phone: string, points: number) => {
  const id = await addCustomer({ phone });
  await addLoyaltyEntry(id, "earn", points);
  return id;
};
/** Created through the API so the change feed carries the customer to registers. */
const pulledWithPoints = async (phone: string, points: number) => {
  const id = v7();
  const made = await portal.create({ id, name: "Ama Points", phone, kind: "individual" });
  expect(made.status).toBe(201);
  await addLoyaltyEntry(id, "earn", points);
  return id;
};

test("a hold needs the points: POINTS_SHORT counts points other holds have set aside, and a release gives them back", async () => {
  const customerId = await withPoints("0271791001", 50);
  const session = await uploader();
  expect(await holds.create(session, customerId, 60)).toMatchObject({
    status: 409,
    body: { code: "POINTS_SHORT", available: 50 },
  });
  const first = await holds.create(session, customerId, 30);
  expect(first).toMatchObject({
    status: 201,
    body: { hold: { kind: "loyalty", points: 30, value: 3_000, status: "held" } },
  });
  expect(await holds.create(session, customerId, 30)).toMatchObject({
    status: 409,
    body: { code: "POINTS_SHORT", available: 20 },
  });
  expect((await holds.create(session, customerId, 20)).status).toBe(201);
  expect((await holds.release(session, first.body.hold.id)).status).toBe(200);
  expect((await holds.create(session, customerId, 30)).status).toBe(201);
  expect(await holdStatuses(customerId)).toEqual(["released", "held", "held"]);
});

test("points must be whole and positive, and an unknown customer is 404", async () => {
  const customerId = await withPoints("0271791002", 50);
  const session = await uploader();
  for (const points of [0, -5, 1.5, "10", null, undefined])
    expect((await holds.create(session, customerId, points)).status).toBe(400);
  expect((await holds.create(session, v7(), 10)).status).toBe(404);
  expect(await holdRows(customerId)).toEqual([]);
});

test("a sale paid with points consumes the hold into a redeem entry; a forged or altered tender is INVALID_PAYMENT", async () => {
  const customerId = await withPoints("0271791003", 300);
  const created = await freshSale();
  const session = await uploader();
  const held = await holds.create(session, customerId, 100);
  const holdId = held.body.hold.id as string;

  // A tender that disagrees with its hold is refused, and nothing is written.
  const altered = [
    pointsSaleEvent(created, customerId, holdId, 90),
    pointsSaleEvent(created, customerId, holdId, 100, 20_000),
    pointsSaleEvent(created, customerId, v7(), 100),
  ];
  for (const event of altered)
    expect((await pushSale(created, event)).body.rejected).toMatchObject([
      { code: "INVALID_PAYMENT" },
    ]);
  expect(await pointEntries(customerId)).toMatchObject([{ reason: "earn", points: 300 }]);

  const accepted = await pushSale(created, pointsSaleEvent(created, customerId, holdId, 100));
  expect(accepted.body.accepted).toHaveLength(1);
  const saleId = created.event.sale.id;
  const entries = await pointEntries(customerId);
  // The seeded 300 is dated now; the sale's own entries carry the sale's (earlier) time.
  const ofSale = entries.filter((e) => e.sale_id === saleId);
  expect(ofSale.map((e) => [e.reason, e.points])).toEqual([
    ["redeem", -100],
    // Earned on the GH₵11.00 paid in cash, not on the GH₵1.00 paid in points: 1% of 11.00 is 0.11, which is 11 points.
    ["earn", 11],
  ]);
  expect(ofSale[0]).toMatchObject({ hold_id: holdId });
  expect(entries).toHaveLength(3);
  expect(await holdRows(customerId)).toMatchObject([
    { id: holdId, status: "consumed", sale_id: saleId },
  ]);
  const { rows } = await databases().db.execute(
    sql`SELECT kind, amount::int AS amount, hold_id FROM sale_tender WHERE org_id = ${ids.org} AND sale_id = ${saleId} ORDER BY position`,
  );
  expect(rows).toMatchObject([
    { kind: "loyalty", amount: 10_000, hold_id: holdId },
    { kind: "cash", amount: 110_000, hold_id: null },
  ]);
  // Replaying the same upload changes nothing.
  expect((await pushSale(created, pointsSaleEvent(created, customerId, holdId, 100))).status).toBe(
    200,
  );
  expect(await pointEntries(customerId)).toHaveLength(3);

  // With no hold behind it the tender is a forged event.
  const forged = await sameTillSale();
  const fake = await pushSale(forged, pointsSaleEvent(forged, customerId, v7(), 100));
  expect(fake.body.rejected).toMatchObject([{ code: "INVALID_PAYMENT" }]);
});

test("at the register, redeeming is online only and the account answers the points and their value", async () => {
  const customerId = await pulledWithPoints("0271791004", 150);
  counter = await startCounter();
  await counter.settle();
  const account = await counter.ask({ type: "customer.account", customerId });
  expect(account).toMatchObject({
    kind: "account",
    account: { points: 150, pointValue: 100, loyaltyEnabled: true },
  });

  const productId = counter.register.fixture.config.references.products[0].id;
  await counter.ask({ type: "add", expectedRevision: 0, productId, quantityThousandths: 100_000 });
  const attached = await counter.ask({ type: "customer.attach", expectedRevision: 1, customerId });
  expect(attached).toMatchObject({ kind: "draft" });
  counter.upstream.setAvailable(false);
  expect(
    await counter.ask({ type: "tender.account", expectedRevision: 2, kind: "loyalty", points: 10 }),
  ).toMatchObject({ type: "error", code: "OFFLINE_UNAVAILABLE" });
  counter.upstream.setAvailable(true);
  expect(
    await counter.ask({
      type: "tender.account",
      expectedRevision: 2,
      kind: "loyalty",
      points: 500,
    }),
  ).toMatchObject({ type: "error", code: "POINTS_SHORT" });

  const added = await counter.ask({
    type: "tender.account",
    expectedRevision: 2,
    kind: "loyalty",
    points: 40,
  });
  const tender = added.view.draft.tenders.find((t: { kind: string }) => t.kind === "loyalty");
  expect(tender).toMatchObject({ kind: "loyalty", amount: 4_000, points: 40 });
  expect(await holdRows(customerId)).toMatchObject([{ id: tender.id, status: "held" }]);
  // Taking the tender off gives the points back.
  const removed = await counter.ask({
    type: "tender.remove",
    expectedRevision: 3,
    tenderId: tender.id,
  });
  expect(removed).toMatchObject({ kind: "draft" });
  await expect
    .poll(async () => (await holdRows(customerId))[0]?.status, { timeout: 10_000 })
    .toBe("released");
});

test("a refund hands redeemed points back first, then reverses what the sale earned, and records points_returned", async () => {
  const customerId = await pulledWithPoints("0271791005", 150);
  counter = await startCounter({ permissions: ["register.settings", "report.read"] });
  await counter.settle();
  // GH₵120.00 of goods, 100 points (GH₵1.00) tendered: earns on the GH₵119.00 paid with money.
  const sold = await customerSale(counter, customerId, { thousandths: 100_000, points: 100 });
  await arrived(counter, sold.saleId);
  // The shift's X counts the points redeemed and what they were worth.
  expect((await report(counter)).account).toMatchObject({ points: 100, pointsValue: 10_000 });
  expect((await pointEntries(customerId)).map((e) => [e.reason, e.points])).toEqual([
    ["earn", 150],
    ["redeem", -100],
    ["earn", 119],
  ]);

  const returned = await counter.ask({
    type: "refund.record",
    receipt: sold.receipt,
    lines: [{ lineId: sold.sale.lines[0].id, quantityThousandths: 100_000 }],
    reason: "Customer returned everything",
    tender: { kind: "cash" },
  });
  expect(returned).toMatchObject({ kind: "refund" });
  const refundId = returned.refund.id as string;
  await expect
    .poll(
      async () => {
        await counter!.sync();
        return (await pointEntries(customerId)).length;
      },
      { timeout: 20_000, interval: 250 },
    )
    .toBe(5);
  // 100 points come back; the earn of 119 is reversed whole (1% of GH₵120 would be 120, capped at what is left).
  const entries = await pointEntries(customerId);
  expect(entries.slice(3).map((e) => [e.reason, e.points, e.refund_id])).toEqual([
    ["reverse", 100, refundId],
    ["reverse", -119, refundId],
  ]);
  expect(await pointEntries(customerId).then((all) => all.reduce((n, e) => n + e.points, 0))).toBe(
    150,
  );
  const { rows } = await databases().db.execute(
    sql`SELECT gross::int AS gross, total::int AS total, points_returned FROM refund WHERE org_id = ${ids.org} AND id = ${refundId}`,
  );
  expect(rows).toEqual([{ gross: 1_200_000, total: 1_190_000, points_returned: 100 }]);
});
