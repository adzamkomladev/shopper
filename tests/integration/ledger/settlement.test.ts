// A MoMo payout empties MoMo clearing by what the customer paid: the bank receives the net and the provider's fee is
// an expense. Recording the same payout again posts nothing more.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { payment } from "@shopper/db-pg";
import { recordSettlements } from "@shopper/core/payments";
import { money } from "@shopper/money";
import { goldenWorld } from "../../support/sales/golden/setup";
import { databases } from "../../support/till/server";
import { balances } from "../../support/ledger/books";

let world: Awaited<ReturnType<typeof goldenWorld>>;
beforeAll(async () => {
  world = await goldenWorld();
});
afterAll(async () => {
  await world?.local.close();
});

test("a settled payment moves MoMo clearing to the bank, less the fee", async () => {
  const { db, context } = databases();
  const reference = `ref-${v7()}`;
  await db.insert(payment).values({
    orgId: world.scope.orgId,
    branchId: world.scope.branchId,
    deviceId: world.scope.deviceId,
    cashierId: world.session.userId,
    reference,
    amount: money(500_000),
    phone: "0240000000",
    network: "mtn",
    status: "confirmed",
  });
  const payout = {
    providerId: `payout-${v7()}`,
    settledOn: "2026-10-16",
    amount: money(490_000),
    fees: money(10_000),
    lines: [{ reference, amount: money(500_000), fee: money(10_000) }],
  };
  const record = () => recordSettlements(db, context, { day: "2026-10-16", payouts: [payout] });
  await record();
  await record();
  expect(await balances({ source: "settlement" })).toEqual(
    new Map([
      ["bank", 490_000],
      ["fees", 10_000],
      ["momo_clearing", -500_000],
    ]),
  );
});
