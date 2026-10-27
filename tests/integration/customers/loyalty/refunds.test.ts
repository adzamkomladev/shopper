// A refund is paid back in a fixed order: to the customer's account first (as a credit note, up to what the sale
// charged), then as redeemed points (whole points, up to what the sale redeemed), and only the rest in the refund's tender.
// GH₵120.00 of goods paid GH₵80 on account + 100 points (GH₵1.00) + GH₵39 cash; 1% earns 119 points on the GH₵119.00 total
// paid with money and account. Returning half, then the other half:
//   first  GH₵60 -> all to the account (GH₵80 charged), nothing paid out, 60 of the earned points reversed
//   second GH₵60 -> GH₵20 to the account, 100 points handed back (GH₵1.00), GH₵39 in cash, the last 59 points reversed
import { afterAll, afterEach, beforeAll, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { portalOwner } from "../../../support/api/portal";
import { customerApi } from "../../../support/customers/http";
import { startCounter } from "../../../support/customers/till";
import { arrived } from "../../../support/customers/account";
import { verifiedCustomer } from "../../../support/customers/credit";
import { entries } from "../../../support/customers/ledger";
import { addLoyaltyEntry, folds } from "../../../support/customers/seed";
import { ON, customerSale, loyaltyApi, pointEntries } from "../../../support/customers/loyalty";
import { ids } from "../../../support/till/sales";
import { databases } from "../../../support/till/server";
import { sentMessages } from "../../../support/stock/queue";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let portal: ReturnType<typeof customerApi>;
let counter: Awaited<ReturnType<typeof startCounter>> | undefined;
beforeAll(async () => {
  world = await goldenWorld();
  const owner = await portalOwner(ids.org, ids.cashier);
  portal = customerApi(owner, owner.cookie);
  expect((await loyaltyApi(owner, owner.cookie).setSettings(ON)).status).toBe(200);
});
afterAll(async () => world?.local.close());
afterEach(async () => {
  await counter?.close();
  counter = undefined;
});

test("a refund goes to the account first, then to redeemed points, then out in its own tender", async () => {
  const customerId = await verifiedCustomer(portal, 2_000_000, { phone: "0271794001" });
  await addLoyaltyEntry(customerId, "earn", 150);
  counter = await startCounter();
  await counter.settle();
  const sold = await customerSale(counter, customerId, {
    thousandths: 100_000,
    credit: 800_000,
    points: 100,
    cash: 400_000,
  });
  await arrived(counter, sold.saleId);
  expect(await folds(customerId)).toEqual({ balance: 800_000, points: 150 - 100 + 119 });
  const wakes = async () =>
    (await sentMessages()).filter(
      (m) =>
        m.type === "account.wake" &&
        (m.payload as { customerId?: string }).customerId === customerId,
    ).length;
  const before = await wakes();

  const refunds: Record<string, any>[] = [];
  for (const [index, quantityThousandths] of [50_000, 50_000].entries()) {
    const reply = await counter.ask({
      type: "refund.record",
      receipt: sold.receipt,
      lines: [{ lineId: sold.sale.lines[0].id, quantityThousandths }],
      reason: "Customer returned half",
      tender: { kind: "cash" },
    });
    expect(reply).toMatchObject({ kind: "refund" });
    await expect
      .poll(
        async () => {
          await counter!.sync();
          const { rows } = await databases().db.execute<Record<string, any>>(sql`
            SELECT gross::int AS gross, account_credit::int AS account_credit, total::int AS total, points_returned,
              points_value::int AS points_value
            FROM refund WHERE org_id = ${ids.org} AND id = ${reply.refund.id}`);
          refunds[index] = rows[0]!;
          return rows[0];
        },
        { timeout: 20_000, interval: 250 },
      )
      .toBeDefined();
  }
  expect(refunds).toEqual([
    { gross: 600_000, account_credit: 600_000, total: 0, points_returned: 0, points_value: 0 },
    {
      gross: 600_000,
      account_credit: 200_000,
      total: 390_000,
      points_returned: 100,
      points_value: 10_000,
    },
  ]);
  expect((await entries(customerId)).map((e) => [e.kind, e.amount])).toEqual([
    ["charge", 800_000],
    ["credit_note", -600_000],
    ["credit_note", -200_000],
  ]);
  const ofRefunds = (await pointEntries(customerId)).filter((e) => e.refund_id);
  expect(ofRefunds.map((e) => e.points)).toEqual([-60, 100, -59]);
  // Everything came back: the account owes nothing and the points are where they began.
  expect(await folds(customerId)).toEqual({ balance: 0, points: 150 });
  // Each refund moved points, so each wakes the account workflow to look at expiry and tiers again.
  expect((await wakes()) - before).toBe(2);
});

// GH₵120.00 paid 6000 points (GH₵60.00) + GH₵60 cash earns 60 points on the money part only. Returning half hands
// back the 6000 points and reverses nothing (no money came back); returning the rest pays GH₵60 and reverses the 60.
test("a refund of a part-points sale reverses the earn only on the money it pays back", async () => {
  const customerId = await verifiedCustomer(portal, 2_000_000, { phone: "0271794002" });
  await addLoyaltyEntry(customerId, "earn", 7000);
  counter = await startCounter();
  await counter.settle();
  const sold = await customerSale(counter, customerId, {
    thousandths: 100_000,
    points: 6000,
    cash: 600_000,
  });
  await arrived(counter, sold.saleId);
  const refunded: Record<string, any>[] = [];
  for (const [index, quantityThousandths] of [50_000, 50_000].entries()) {
    const reply = await counter.ask({
      type: "refund.record",
      receipt: sold.receipt,
      lines: [{ lineId: sold.sale.lines[0].id, quantityThousandths }],
      reason: "Customer returned half",
      tender: { kind: "cash" },
    });
    expect(reply).toMatchObject({ kind: "refund" });
    await expect
      .poll(
        async () => {
          await counter!.sync();
          const { rows } = await databases().db.execute<Record<string, any>>(sql`
            SELECT id, total::int AS total, points_returned, points_value::int AS points_value FROM refund
            WHERE org_id = ${ids.org} AND id = ${reply.refund.id}`);
          refunded[index] = rows[0]!;
          return rows[0];
        },
        { timeout: 20_000, interval: 250 },
      )
      .toBeDefined();
  }
  expect(refunded).toEqual([
    { id: expect.any(String), total: 0, points_returned: 6000, points_value: 600_000 },
    { id: expect.any(String), total: 600_000, points_returned: 0, points_value: 0 },
  ]);
  const ofRefunds = (await pointEntries(customerId)).filter((e) => e.refund_id);
  expect(ofRefunds.map((e) => [e.refund_id, e.points])).toEqual([
    [refunded[0]!.id, 6000],
    [refunded[1]!.id, -60],
  ]);
  expect(await folds(customerId)).toEqual({ balance: 0, points: 7000 });
});
