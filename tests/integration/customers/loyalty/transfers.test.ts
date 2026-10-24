// Points transfers: POST /loyalty/transfers {fromId, toId, points, reason} needs customer.manage and writes a pair of
// `transfer` entries in one command, so both folds change and the org's total does not. Refused with 409:
// POINTS_SHORT (points held for a sale count as spent), SAME_CUSTOMER, ARCHIVED (either side), LOYALTY_OFF; 403 without
// the permission; 404 for an unknown customer; 400 for points that are not whole and positive or a missing reason.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { portalMember, portalOwner, type Portal } from "../../../support/api/portal";
import { addCustomer, addHold, addLoyaltyEntry, folds } from "../../../support/customers/seed";
import { auditCommands, chainValid } from "../../../support/customers/ledger";
import { ON, loyaltyApi, orgPoints, pointEntries } from "../../../support/customers/loyalty";
import { ids } from "../../../support/till/sales";
import { databases } from "../../../support/till/server";
import { sql } from "drizzle-orm";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let admin: ReturnType<typeof loyaltyApi>;
let accountant: ReturnType<typeof loyaltyApi>;
let cashier: ReturnType<typeof loyaltyApi>;
beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  admin = loyaltyApi(owner, owner.cookie);
  accountant = loyaltyApi(owner, await portalMember(owner, "accountant"));
  cashier = loyaltyApi(owner, await portalMember(owner, "cashier"));
  expect((await admin.setSettings(ON)).status).toBe(200);
});
afterAll(async () => world?.local.close());

async function pair(phones: [string, string], points: [number, number]) {
  const [a, b] = await Promise.all(phones.map((phone) => addCustomer({ phone })));
  await addLoyaltyEntry(a!, "earn", points[0]);
  if (points[1]) await addLoyaltyEntry(b!, "earn", points[1]);
  return { a: a!, b: b! };
}

test("40 points move from A to B as a pair of entries: both folds change, the org total does not, and it is audited", async () => {
  const { a, b } = await pair(["0271793001", "0271793002"], [100, 10]);
  const before = await orgPoints();
  const moved = await accountant.transfer({
    fromId: a,
    toId: b,
    points: 40,
    reason: "Family account",
  });
  expect(moved).toMatchObject({ status: 201, body: { fromId: a, toId: b, points: 40 } });
  expect(await folds(a)).toMatchObject({ points: 60 });
  expect(await folds(b)).toMatchObject({ points: 50 });
  expect(await orgPoints()).toBe(before);
  expect((await pointEntries(a)).at(-1)).toMatchObject({ reason: "transfer", points: -40 });
  expect((await pointEntries(b)).at(-1)).toMatchObject({ reason: "transfer", points: 40 });
  expect((await admin.customer(a)).body.points).toBe(60);
  expect((await admin.history(b)).body.entries.at(-1)).toMatchObject({
    reason: "transfer",
    balance: 50,
  });
  const { rows } = await databases().db.execute(
    sql`SELECT payload, actor_id FROM audit_log WHERE org_id = ${ids.org} AND command = 'loyalty.transfer' ORDER BY chain_seq`,
  );
  expect(rows.at(-1)!.payload).toMatchObject({
    fromId: a,
    toId: b,
    points: 40,
    reason: "Family account",
  });
  expect(await auditCommands(a)).toContain("loyalty.transfer");
  expect(await chainValid()).toBe(true);
});

test("points short is refused, and points held for a sale count as already spent", async () => {
  const { a, b } = await pair(["0271793003", "0271793004"], [60, 0]);
  expect(
    (await admin.transfer({ fromId: a, toId: b, points: 61, reason: "Too many" })).status,
  ).toBe(409);
  const refused = await admin.transfer({ fromId: a, toId: b, points: 61, reason: "Too many" });
  expect(refused.body).toMatchObject({ code: "POINTS_SHORT", available: 60 });
  await addHold(a, "loyalty", 30);
  expect(
    (await admin.transfer({ fromId: a, toId: b, points: 31, reason: "Held" })).body,
  ).toMatchObject({
    code: "POINTS_SHORT",
    available: 30,
  });
  expect(await folds(a)).toMatchObject({ points: 60 });
  expect(await folds(b)).toMatchObject({ points: 0 });
  expect(
    (await admin.transfer({ fromId: a, toId: b, points: 30, reason: "Within what is free" }))
      .status,
  ).toBe(201);
});

test("the same customer, an archived one on either side, and loyalty being off are refused with nothing written", async () => {
  const { a, b } = await pair(["0271793005", "0271793006"], [100, 100]);
  const archived = await addCustomer({ phone: "0271793007", archivedAt: new Date() });
  const entries = async () => [(await pointEntries(a)).length, (await pointEntries(b)).length];
  const start = await entries();
  expect(
    (await admin.transfer({ fromId: a, toId: a, points: 1, reason: "Self" })).body,
  ).toMatchObject({
    code: "SAME_CUSTOMER",
  });
  expect(
    (await admin.transfer({ fromId: a, toId: archived, points: 1, reason: "To" })).body,
  ).toMatchObject({
    code: "ARCHIVED",
  });
  expect(
    (await admin.transfer({ fromId: archived, toId: b, points: 1, reason: "From" })).body,
  ).toMatchObject({
    code: "ARCHIVED",
  });
  expect((await admin.setSettings({ ...ON, enabled: false })).status).toBe(200);
  expect(
    (await admin.transfer({ fromId: a, toId: b, points: 1, reason: "Off" })).body,
  ).toMatchObject({
    code: "LOYALTY_OFF",
  });
  expect((await admin.setSettings(ON)).status).toBe(200);
  expect(await entries()).toEqual(start);
});

test("403 without customer.manage, 404 for an unknown customer, 400 for a malformed request", async () => {
  const { a, b } = await pair(["0271793008", "0271793009"], [100, 0]);
  expect((await cashier.transfer({ fromId: a, toId: b, points: 5, reason: "Nope" })).status).toBe(
    403,
  );
  expect((await admin.transfer({ fromId: a, toId: v7(), points: 5, reason: "Ghost" })).status).toBe(
    404,
  );
  expect((await admin.transfer({ fromId: v7(), toId: b, points: 5, reason: "Ghost" })).status).toBe(
    404,
  );
  for (const bad of [
    { fromId: a, toId: b, points: 0, reason: "Zero" },
    { fromId: a, toId: b, points: -5, reason: "Negative" },
    { fromId: a, toId: b, points: 1.5, reason: "Part" },
    { fromId: a, toId: b, points: 5 },
    { fromId: a, toId: b, points: 5, reason: "" },
    { fromId: "not-an-id", toId: b, points: 5, reason: "Bad id" },
    { fromId: a, toId: b, points: 5, reason: "Extra", note: 1 },
  ])
    expect((await admin.transfer(bad)).status).toBe(400);
  expect(await folds(a)).toMatchObject({ points: 100 });
  expect(await folds(b)).toMatchObject({ points: 0 });
});
