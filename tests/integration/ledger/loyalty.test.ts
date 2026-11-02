// Points are a liability: an earn accrues its value (Dr loyalty rewards / Cr loyalty points), spending them at the
// till pays part of a sale out of the liability, and expiry releases what lapsed. With one point value throughout,
// the liability always equals the org's points fold times that value.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import { expirePoints } from "@shopper/core/customers";
import { goldenWorld } from "../../support/sales/golden/setup";
import { addCustomer } from "../../support/customers/seed";
import { uploader } from "../../support/customers/till";
import { setOrg } from "../../support/customers/due";
import { freshSale, pushSale, sameTillSale } from "../../support/customers/credit";
import {
  cashSaleEvent,
  loyaltyHolds,
  orgPoints,
  pointsSaleEvent,
} from "../../support/customers/loyalty";
import { databases } from "../../support/till/server";
import { balances, entriesOf, trialBalanceZero } from "../../support/ledger/books";

const POINT_VALUE = 100;
let world: Awaited<ReturnType<typeof goldenWorld>>;
beforeAll(async () => {
  world = await goldenWorld();
  await setOrg({
    loyalty_enabled: true,
    loyalty_earn_bps: 100,
    loyalty_point_value: POINT_VALUE,
    loyalty_expiry_days: 30,
    tier_notice_days: 0,
  });
});
afterAll(async () => world?.local.close());

const liabilityMatchesPoints = async () =>
  expect((await balances()).get("loyalty") ?? 0).toBe(0 - (await orgPoints()) * POINT_VALUE);

test("earning, spending and expiry keep the loyalty liability equal to the points fold", async () => {
  const customerId = await addCustomer({ phone: "0271840001" });
  const first = await freshSale();
  expect((await pushSale(first, cashSaleEvent(first, customerId))).body.rejected).toEqual([]);
  const earned = (await entriesOf("sale", first.event.sale.id))[0]!.lines;
  expect(earned.rewards).toBeGreaterThan(0);
  expect(earned.loyalty).toBe(-earned.rewards!);
  await liabilityMatchesPoints();

  const second = await sameTillSale();
  const holdId = v7();
  expect(
    (await loyaltyHolds().create(await uploader(), customerId, 10, { id: holdId })).status,
  ).toBe(201);
  const spent = await pushSale(second, pointsSaleEvent(second, customerId, holdId, 10));
  expect(spent.body.rejected, JSON.stringify(spent.body)).toEqual([]);
  await liabilityMatchesPoints();

  // Thirty days on, what is left of the lots lapses and the liability goes with it.
  const expired = await expirePoints(databases().db, databases().context, {
    customerId,
    at: new Date("2026-03-01T00:00:00Z"),
  });
  expect(expired.expired.length).toBeGreaterThan(0);
  const { rows } = await databases().db.execute<{ id: string }>(
    sql`SELECT id FROM loyalty_entry WHERE customer_id = ${customerId} AND reason = 'expire'`,
  );
  expect((await entriesOf("loyalty", rows[0]!.id))[0]!.lines.rewards).toBeLessThan(0);
  await liabilityMatchesPoints();
  expect(await trialBalanceZero()).toBe(true);
});
