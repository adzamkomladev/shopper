// Loyalty is set per org and is off by default: GET/PUT /settings/loyalty {enabled, earnBps 1-10000, pointValue > 0
// (money units per point), expiryDays >= 0, tierNoticeDays >= 0} need customer.manage. While it is off nothing is
// earned and a points hold or transfer is refused with 409 LOYALTY_OFF.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { portalMember, portalOwner, type Portal } from "../../../support/api/portal";
import { addCustomer } from "../../../support/customers/seed";
import { uploader } from "../../../support/customers/till";
import { auditCommands, chainValid } from "../../../support/customers/ledger";
import {
  ON,
  cashSaleEvent,
  loyaltyApi,
  loyaltyHolds,
  pointEntries,
} from "../../../support/customers/loyalty";
import { freshSale, pushSale, sameTillSale } from "../../../support/customers/credit";
import { ids } from "../../../support/till/sales";
import { databases, principal } from "../../../support/till/server";
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
});
afterAll(async () => world?.local.close());

test("loyalty is off by default and nothing is earned until it is switched on", async () => {
  const start = await admin.settings();
  expect(start).toMatchObject({
    status: 200,
    body: { enabled: false, earnBps: 0, pointValue: 0, expiryDays: 0, tierNoticeDays: 14 },
  });
  const customerId = await addCustomer({ phone: "0271780001" });
  const first = await freshSale();
  expect((await pushSale(first, cashSaleEvent(first, customerId))).body.accepted).toHaveLength(1);
  expect(await pointEntries(customerId)).toEqual([]);
});

test("a manager switches it on, the earn rate and point value apply to the next sale, and it is audited", async () => {
  const put = await accountant.setSettings(ON);
  expect(put).toMatchObject({ status: 200, body: ON });
  expect((await admin.settings()).body).toEqual(ON);
  const customerId = await addCustomer({ phone: "0271780002" });
  const sale = await sameTillSale();
  expect((await pushSale(sale, cashSaleEvent(sale, customerId))).body.accepted).toHaveLength(1);
  // GH₵12.00 at 100 bps is GH₵0.12, which is 12 points of GH₵0.01; the entry keeps what it was worked out with.
  expect(await pointEntries(customerId)).toMatchObject([
    { reason: "earn", points: 12, rate_bps: 100, point_value: 100, sale_id: sale.event.sale.id },
  ]);

  const changed = { ...ON, earnBps: 250, pointValue: 50, expiryDays: 90, tierNoticeDays: 0 };
  expect((await admin.setSettings(changed)).body).toEqual(changed);
  const { rows } = await databases().db.execute(
    sql`SELECT payload FROM audit_log WHERE org_id = ${ids.org} AND command = 'loyalty.settings.set' ORDER BY chain_seq`,
  );
  expect(rows).toHaveLength(2);
  expect(rows[1]!.payload).toMatchObject({ after: changed, before: ON });
  expect(await chainValid()).toBe(true);
  // Put it back for the rest of the suite.
  expect((await admin.setSettings(ON)).status).toBe(200);
});

test("values outside the limits are refused with 400 and change nothing", async () => {
  const before = (await admin.settings()).body;
  const bad: Record<string, unknown>[] = [
    { ...ON, earnBps: 0 },
    { ...ON, earnBps: 10_001 },
    { ...ON, earnBps: 1.5 },
    { ...ON, pointValue: 0 },
    { ...ON, pointValue: -100 },
    { ...ON, expiryDays: -1 },
    { ...ON, tierNoticeDays: -1 },
    { ...ON, enabled: "yes" },
    { ...ON, extra: 1 },
    { enabled: true },
  ];
  for (const body of bad) expect((await admin.setSettings(body)).status).toBe(400);
  expect((await admin.settings()).body).toEqual(before);
});

test("only customer.manage reads or writes the settings: a cashier gets 403", async () => {
  expect((await cashier.settings()).status).toBe(403);
  expect((await cashier.setSettings(ON)).status).toBe(403);
  expect((await admin.settings()).body).toEqual(ON);
  const anonymous = await owner.api.request("/settings/loyalty");
  expect(anonymous.status).toBe(401);
});

test("with loyalty off, a points hold is refused with LOYALTY_OFF and no hold is written", async () => {
  const customerId = await addCustomer({ phone: "0271780003" });
  await databases().db.execute(
    sql`INSERT INTO loyalty_entry (org_id, customer_id, reason, points, actor_id, occurred_at)
        VALUES (${ids.org}, ${customerId}, 'earn', 80, ${principal.userId}, now())`,
  );
  const holds = loyaltyHolds();
  const session = await uploader();
  expect((await admin.setSettings({ ...ON, enabled: false })).status).toBe(200);
  expect(await holds.create(session, customerId, 10)).toMatchObject({
    status: 409,
    body: { code: "LOYALTY_OFF" },
  });
  expect((await holds.account(customerId)).body).toMatchObject({
    loyaltyEnabled: false,
    points: 80,
  });
  expect((await admin.setSettings(ON)).status).toBe(200);
  expect(await holds.create(session, customerId, 10)).toMatchObject({ status: 201 });
  expect(await auditCommands(customerId)).toContain("customer.hold.create");
});
