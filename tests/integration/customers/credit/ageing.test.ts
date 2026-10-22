// Ageing: payments and credit notes are applied first-in-first-out to the oldest charges, and what is left of each
// charge is bucketed by the days it is past its terms (charge date + credit_terms_days, default 30). Nothing is
// stored. Dates are fixed: the clock is frozen at 2026-10-15 12:00 UTC (Date only) and entries are dated by hand.
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { ids } from "../../../support/till/sales";
import { databases } from "../../../support/till/server";
import { portalMember, portalOwner } from "../../../support/api/portal";
import { parseCsv } from "../../../support/customers/http";
import { addCustomer } from "../../../support/customers/seed";
import { addEntryAt, creditApi } from "../../../support/customers/ledger";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let accountant: ReturnType<typeof creditApi>;
let inventory: ReturnType<typeof creditApi>;
beforeAll(async () => {
  world = await goldenWorld();
  const owner = await portalOwner(ids.org, ids.cashier);
  accountant = creditApi(owner, await portalMember(owner, "accountant"));
  inventory = creditApi(owner, await portalMember(owner, "inventory"));
});
afterAll(async () => world?.local.close());
// A clock earlier than the real one, so the members' sessions are still valid.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const buckets = (over: Record<string, number> = {}) => ({
  current: 0,
  "1-30": 0,
  "31-60": 0,
  "61-90": 0,
  "90+": 0,
  ...over,
});

/** Five charges of different ages, then GH₵8 paid and GH₵2 credited: both come off the oldest charge. */
async function mixed(phone: string, name: string) {
  const id = await addCustomer({ name, phone, creditLimit: 5_000_000 });
  await addEntryAt(id, "charge", 300_000, "2026-05-01T12:00:00Z"); // due 31 May, 137 days past
  await addEntryAt(id, "charge", 150_000, "2026-06-25T12:00:00Z"); // due 25 Jul, 82 days past
  await addEntryAt(id, "charge", 200_000, "2026-07-31T12:00:00Z"); // due 30 Aug, 46 days past
  await addEntryAt(id, "charge", 300_000, "2026-09-05T12:00:00Z"); // due 5 Oct, 10 days past
  await addEntryAt(id, "charge", 400_000, "2026-10-01T12:00:00Z"); // due 31 Oct, not yet due
  await addEntryAt(id, "payment", -80_000, "2026-10-06T12:00:00Z");
  await addEntryAt(id, "credit_note", -20_000, "2026-10-08T12:00:00Z");
  return id;
}

test("payments and credit notes settle the oldest charge first and the rest is bucketed by days past terms", async () => {
  const id = await mixed("0271740001", "Ageing Mixed");
  const aged = await accountant.ageing(id);
  expect(aged.status).toBe(200);
  expect(aged.body).toMatchObject({
    total: 1_250_000,
    buckets: buckets({
      current: 400_000,
      "1-30": 300_000,
      "31-60": 200_000,
      "61-90": 150_000,
      "90+": 200_000,
    }),
  });
});

test("a charge is current up to its due day and one day past terms the day after; each bucket edge falls the right way", async () => {
  const id = await addCustomer({ phone: "0271740002", creditLimit: 5_000_000 });
  // Charge date, days past terms on 15 Oct: 15 Sep (0), 14 Sep (1), 16 Aug (30), 15 Aug (31),
  // 17 Jul (60), 16 Jul (61), 17 Jun (90), 16 Jun (91).
  const dated: [string, number][] = [
    ["2026-09-15", 100_000],
    ["2026-09-14", 200_000],
    ["2026-08-16", 300_000],
    ["2026-08-15", 400_000],
    ["2026-07-17", 500_000],
    ["2026-07-16", 600_000],
    ["2026-06-17", 700_000],
    ["2026-06-16", 800_000],
  ];
  for (const [day, amount] of dated) await addEntryAt(id, "charge", amount, `${day}T12:00:00Z`);
  expect((await accountant.ageing(id)).body).toMatchObject({
    total: 3_600_000,
    buckets: buckets({
      current: 100_000,
      "1-30": 500_000,
      "31-60": 900_000,
      "61-90": 1_300_000,
      "90+": 800_000,
    }),
  });
});

test("the terms come from the org's credit_terms_days", async () => {
  const id = await mixed("0271740003", "Ageing Terms");
  const { db } = databases();
  await db.execute(sql`UPDATE org SET credit_terms_days = 60 WHERE id = ${ids.org}`);
  try {
    expect((await accountant.ageing(id)).body.buckets).toEqual(
      buckets({ current: 700_000, "1-30": 200_000, "31-60": 150_000, "90+": 200_000 }),
    );
  } finally {
    await db.execute(sql`UPDATE org SET credit_terms_days = 30 WHERE id = ${ids.org}`);
  }
});

test("a customer who has paid everything has nothing aged, and an unknown or foreign customer is 404", async () => {
  const id = await addCustomer({ phone: "0271740004" });
  await addEntryAt(id, "charge", 100_000, "2026-06-01T12:00:00Z");
  await addEntryAt(id, "payment", -100_000, "2026-06-10T12:00:00Z");
  expect((await accountant.ageing(id)).body).toMatchObject({ total: 0, buckets: buckets() });
  const foreign = await addCustomer({ orgId: ids.otherOrg });
  expect((await accountant.ageing(foreign)).status).toBe(404);
  expect((await inventory.ageing(id)).status).toBe(403);
});

test("the ageing CSV lists each customer's buckets in cedis and is a CSV download", async () => {
  await mixed("0271740005", "Ageing Csv One");
  const csv = await accountant.ageingCsv();
  expect(csv.status).toBe(200);
  expect(csv.type).toMatch(/^text\/csv/);
  const [header, ...rows] = parseCsv(csv.text.trimEnd());
  expect(header).toEqual(
    expect.arrayContaining(["Name", "Phone", "Current", "1-30", "31-60", "61-90", "90+", "Total"]),
  );
  const cells = rows.find((r) => r.includes("Ageing Csv One"))!;
  const row = Object.fromEntries(header!.map((name, i) => [name, cells[i]]));
  expect(row).toMatchObject({
    Name: "Ageing Csv One",
    Phone: "0271740005",
    Current: "40.00",
    "1-30": "30.00",
    "31-60": "20.00",
    "61-90": "15.00",
    "90+": "20.00",
    Total: "125.00",
  });
  expect((await inventory.ageingCsv()).status).toBe(403);
});
