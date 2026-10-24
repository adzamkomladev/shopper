// Interest: on the 1st of each Accra month, `credit_interest_bps` of the balance aged past `credit_terms_days` is
// charged as one `interest` entry per customer and period. Simple interest: earlier interest is not charged on.
//   postInterest(db, ctx, { customerId, at })  -> { posted, period, amount }   (@shopper/core/customers)
//   accountDue(db, orgId, customerId, now)     -> the next moment something is due, or null
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { accountDue, postInterest } from "@shopper/core/customers";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { addCustomer } from "../../../support/customers/seed";
import { addEntryAt, auditCommands, chainValid, entries } from "../../../support/customers/ledger";
import { context, setOrg } from "../../../support/customers/due";
import { ids } from "../../../support/till/sales";
import { databases } from "../../../support/till/server";

let world: Awaited<ReturnType<typeof goldenWorld>>;
beforeAll(async () => {
  world = await goldenWorld();
  await setOrg({ credit_terms_days: 30, credit_interest_bps: 200 });
});
afterAll(async () => world?.local.close());

const db = () => databases().db;
const november = new Date("2026-11-01T00:00:00.000Z");
const december = new Date("2026-12-01T00:00:00.000Z");
const interest = async (customerId: string) =>
  (await entries(customerId)).filter((entry) => entry.kind === "interest");

test("interest is charged once a period, on the overdue principal only", async () => {
  const customerId = await addCustomer({ phone: "0271793001" });
  // GH₵100 charged on 1 Sep is past its 30 days by November; the GH₵50 of 25 Oct is not yet.
  await addEntryAt(customerId, "charge", 1_000_000, "2026-09-01T10:00:00Z");
  await addEntryAt(customerId, "payment", -200_000, "2026-09-15T10:00:00Z");
  await addEntryAt(customerId, "charge", 500_000, "2026-10-25T10:00:00Z");
  expect(await accountDue(db(), ids.org, customerId, new Date("2026-10-23T09:00:00Z"))).toEqual(
    november,
  );

  // The payment settles the oldest charge first: GH₵80 overdue at 2% is GH₵1.60.
  expect(await postInterest(db(), context, { customerId, at: november })).toMatchObject({
    posted: true,
    period: "2026-11",
    amount: 16_000,
  });
  // December: both charges are overdue (GH₵130), and November's interest is not charged on.
  expect(await postInterest(db(), context, { customerId, at: december })).toMatchObject({
    posted: true,
    period: "2026-12",
    amount: 26_000,
  });
  expect((await interest(customerId)).map((entry) => entry.amount)).toEqual([16_000, 26_000]);
  expect(await auditCommands(customerId)).toContain("credit.interest");
  expect(await chainValid()).toBe(true);
});

test("a replayed period is a no-op", async () => {
  const customerId = await addCustomer({ phone: "0271793002" });
  await addEntryAt(customerId, "charge", 1_000_000, "2026-09-01T10:00:00Z");
  const first = await postInterest(db(), context, { customerId, at: november });
  expect(first).toMatchObject({ posted: true, amount: 20_000 });
  const again = await postInterest(db(), context, { customerId, at: november });
  expect(again).toMatchObject({ posted: false, period: "2026-11", amount: 20_000 });
  expect(await interest(customerId)).toHaveLength(1);
});

test("nothing is charged when nothing is overdue, and nothing is due", async () => {
  const customerId = await addCustomer({ phone: "0271793003" });
  await addEntryAt(customerId, "charge", 1_000_000, "2026-10-20T10:00:00Z");
  expect(await postInterest(db(), context, { customerId, at: november })).toMatchObject({
    posted: false,
    amount: 0,
  });
  // The charge falls past its terms on 20 Nov, so the first period that charges it is December.
  expect(await accountDue(db(), ids.org, customerId, new Date("2026-10-23T09:00:00Z"))).toEqual(
    december,
  );
  await addEntryAt(customerId, "payment", -1_000_000, "2026-10-22T10:00:00Z");
  expect(await accountDue(db(), ids.org, customerId, new Date("2026-10-23T09:00:00Z"))).toBeNull();
});

test("with 0 bps interest is off: nothing is posted and nothing is due", async () => {
  await setOrg({ credit_interest_bps: 0 });
  try {
    const customerId = await addCustomer({ phone: "0271793004" });
    await addEntryAt(customerId, "charge", 1_000_000, "2026-08-01T10:00:00Z");
    expect(await postInterest(db(), context, { customerId, at: november })).toMatchObject({
      posted: false,
      amount: 0,
    });
    expect(await interest(customerId)).toEqual([]);
    expect(
      await accountDue(db(), ids.org, customerId, new Date("2026-10-23T09:00:00Z")),
    ).toBeNull();
  } finally {
    await setOrg({ credit_interest_bps: 200 });
  }
});
