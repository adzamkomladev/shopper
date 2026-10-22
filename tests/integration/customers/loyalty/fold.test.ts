// Loyalty balance equals ledger fold. Settings: 100 bps, 1 point = GH₵0.01. Every sale goes through a real register
// and the real sync lane (a customer is attached, the sale uploads, acceptSale earns); the amounts are the register's
// own totals after 10p cash rounding:
//   sale A  GH₵50.0004 -> total 50.00   -> earns  50
//   sale B  GH₵120.00  -> total 120.00  -> earns 120
//   sale C  GH₵33.3504 -> total 33.40   -> earns  33 (33.40 floors; the cedi cannot buy a part of a point)
//   sale D  GH₵20.0004, 100 points (GH₵1.00) tendered -> total 20.00, earns on the 19.00 paid with money -> -100, +19
//   refund of GH₵60 of sale B -> reverses 60 at the rate stored on B's earn entry
//   balance 50 + 120 + 33 - 100 + 19 - 60 = 62
import { afterAll, afterEach, beforeAll, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { portalOwner } from "../../../support/api/portal";
import { customerApi } from "../../../support/customers/http";
import { startCounter } from "../../../support/customers/till";
import { arrived } from "../../../support/customers/account";
import { failure, chainValid } from "../../../support/customers/ledger";
import {
  ON,
  customerSale,
  loyaltyApi,
  pointEntries,
  pointsFold,
} from "../../../support/customers/loyalty";
import { ids } from "../../../support/till/sales";
import { databases } from "../../../support/till/server";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let loyalty: ReturnType<typeof loyaltyApi>;
let portal: ReturnType<typeof customerApi>;
let counter: Awaited<ReturnType<typeof startCounter>> | undefined;
beforeAll(async () => {
  world = await goldenWorld();
  const owner = await portalOwner(ids.org, ids.cashier);
  loyalty = loyaltyApi(owner, owner.cookie);
  portal = customerApi(owner, owner.cookie);
});
afterAll(async () => world?.local.close());
afterEach(async () => {
  await counter?.close();
  counter = undefined;
});

test("Loyalty balance equals ledger fold", async () => {
  expect((await loyalty.setSettings(ON)).status).toBe(200);
  const customerId = v7();
  const created = await portal.create({
    id: customerId,
    name: "Ama Mensah",
    phone: "0271790001",
    kind: "individual",
  });
  expect(created.status).toBe(201);
  counter = await startCounter();
  await counter.settle();

  const sale = async (thousandths: number, points?: number) => {
    const sold = await customerSale(counter!, customerId, { thousandths, points });
    await arrived(counter!, sold.saleId);
    return sold;
  };
  const a = await sale(41_667);
  expect((await loyalty.customer(customerId)).body.points).toBe(50);
  const b = await sale(100_000);
  await sale(27_792);
  expect((await loyalty.customer(customerId)).body.points).toBe(203);
  await sale(16_667, 100);
  expect((await loyalty.customer(customerId)).body.points).toBe(122);
  expect([a.sale.total, b.sale.total]).toEqual([500_000, 1_200_000]);

  const returned = await counter.ask({
    type: "refund.record",
    receipt: b.receipt,
    lines: [{ lineId: b.sale.lines[0].id, quantityThousandths: 50_000 }],
    reason: "Customer returned half",
    tender: { kind: "cash" },
  });
  expect(returned).toMatchObject({ kind: "refund" });
  await expect
    .poll(
      async () => {
        await counter!.sync();
        return (await pointEntries(customerId)).length;
      },
      { timeout: 20_000, interval: 250 },
    )
    .toBe(6);

  // The API, the ledger sum and the last running balance all say 62.
  expect((await loyalty.customer(customerId)).body).toMatchObject({ points: 62 });
  expect(await pointsFold(customerId)).toBe(62);
  const history = await loyalty.history(customerId);
  expect(history.status).toBe(200);
  expect(history.body.points).toBe(62);
  expect(history.body.entries.map((e: any) => [e.reason, e.points, e.balance])).toEqual([
    ["earn", 50, 50],
    ["earn", 120, 170],
    ["earn", 33, 203],
    ["redeem", -100, 103],
    ["earn", 19, 122],
    ["reverse", -60, 62],
  ]);
  expect(history.body.entries.at(-1).balance).toBe(62);
  // An earn keeps the rate and point value it used; the reversal answers to the sale it reverses.
  const entries = await pointEntries(customerId);
  expect(entries[1]).toMatchObject({ reason: "earn", rate_bps: 100, point_value: 100 });
  expect(entries[5]).toMatchObject({ reason: "reverse", sale_id: b.saleId });
  expect(entries[5]!.refund_id).not.toBeNull();

  // Nothing stores a balance, and history cannot be rewritten.
  const { rows: columns } = await databases().db.execute<{ table_name: string }>(sql`
    SELECT table_name FROM information_schema.columns
    WHERE table_name IN ('customer', 'loyalty_entry') AND column_name IN ('balance', 'points_balance')`);
  expect(columns).toEqual([]);
  expect(
    await failure(
      databases().db.execute(sql`UPDATE loyalty_entry SET points = 1 WHERE org_id = ${ids.org}`),
    ),
  ).toMatch(/append-only|history|immutable|cannot/i);
  expect(
    await failure(databases().db.execute(sql`DELETE FROM loyalty_entry WHERE org_id = ${ids.org}`)),
  ).toMatch(/append-only|history|immutable|cannot/i);
  expect(await pointsFold(customerId)).toBe(62);
  expect(await chainValid()).toBe(true);
});
