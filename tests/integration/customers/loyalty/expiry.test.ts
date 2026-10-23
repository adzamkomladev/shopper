// Points expiry: with `loyalty_expiry_days` set, each earn lot lapses that many days after it was earned. Spending
// takes the oldest lots first, so an expiry takes only what is left of its lot, as one `expire` entry per lot.
//   expirePoints(db, ctx, { customerId, at })  -> { expired: [{ lotId, points }] }   (@shopper/core/customers)
//   accountDue(db, orgId, customerId, now)     -> the next lot expiry (or another due moment), or null
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { accountDue, expirePoints } from "@shopper/core/customers";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { addCustomer } from "../../../support/customers/seed";
import { auditCommands, chainValid } from "../../../support/customers/ledger";
import { pointEntries, pointsFold } from "../../../support/customers/loyalty";
import { context, pointsAt, setOrg } from "../../../support/customers/due";
import { ids } from "../../../support/till/sales";
import { databases } from "../../../support/till/server";

let world: Awaited<ReturnType<typeof goldenWorld>>;
beforeAll(async () => {
  world = await goldenWorld();
  await setOrg({
    loyalty_enabled: true,
    loyalty_earn_bps: 100,
    loyalty_point_value: 100,
    loyalty_expiry_days: 30,
    tier_notice_days: 0,
  });
});
afterAll(async () => world?.local.close());

const db = () => databases().db;
const expiries = async (customerId: string) =>
  (await pointEntries(customerId))
    .filter((entry) => entry.reason === "expire")
    .map((entry) => entry.points);

test("lots expire FIFO after 30 days, redeemed points are not expired, and the balance is the fold", async () => {
  const customerId = await addCustomer({ phone: "0271794001" });
  await pointsAt(customerId, "earn", 100, "2026-09-01T10:00:00Z");
  await pointsAt(customerId, "redeem", -60, "2026-09-10T10:00:00Z");
  await pointsAt(customerId, "earn", 50, "2026-09-20T10:00:00Z");
  expect(await accountDue(db(), ids.org, customerId, new Date("2026-09-25T00:00:00Z"))).toEqual(
    new Date("2026-10-01T10:00:00Z"),
  );

  // The first lot lapses on 1 Oct: the 60 redeemed came out of it, so 40 expire. The second lot is untouched.
  const first = await expirePoints(db(), context, {
    customerId,
    at: new Date("2026-10-01T10:00:00Z"),
  });
  expect(first.expired.map((lot) => lot.points)).toEqual([40]);
  expect(await pointsFold(customerId)).toBe(50);
  expect(await accountDue(db(), ids.org, customerId, new Date("2026-10-01T10:00:00Z"))).toEqual(
    new Date("2026-10-20T10:00:00Z"),
  );

  const second = await expirePoints(db(), context, {
    customerId,
    at: new Date("2026-10-21T00:00:00Z"),
  });
  expect(second.expired.map((lot) => lot.points)).toEqual([50]);
  expect(await expiries(customerId)).toEqual([-40, -50]);
  expect(await pointsFold(customerId)).toBe(0);
  expect(await accountDue(db(), ids.org, customerId, new Date("2026-10-21T00:00:00Z"))).toBeNull();
  expect(await auditCommands(customerId)).toContain("loyalty.expire");
  expect(await chainValid()).toBe(true);
});

test("expiring again is a no-op, and a fully redeemed lot writes nothing", async () => {
  const customerId = await addCustomer({ phone: "0271794002" });
  await pointsAt(customerId, "earn", 30, "2026-09-01T10:00:00Z");
  await pointsAt(customerId, "redeem", -30, "2026-09-05T10:00:00Z");
  await pointsAt(customerId, "earn", 20, "2026-09-02T10:00:00Z");
  const at = new Date("2026-10-05T00:00:00Z");
  expect((await expirePoints(db(), context, { customerId, at })).expired).toMatchObject([
    { points: 20 },
  ]);
  expect((await expirePoints(db(), context, { customerId, at })).expired).toEqual([]);
  expect(await expiries(customerId)).toEqual([-20]);
  expect(await pointsFold(customerId)).toBe(0);
});

test("with expiry at 0 nothing lapses and nothing is due", async () => {
  await setOrg({ loyalty_expiry_days: 0 });
  try {
    const customerId = await addCustomer({ phone: "0271794003" });
    await pointsAt(customerId, "earn", 100, "2025-01-01T10:00:00Z");
    const at = new Date("2026-10-21T00:00:00Z");
    expect((await expirePoints(db(), context, { customerId, at })).expired).toEqual([]);
    expect(await accountDue(db(), ids.org, customerId, at)).toBeNull();
    expect(await pointsFold(customerId)).toBe(100);
  } finally {
    await setOrg({ loyalty_expiry_days: 30 });
  }
});
