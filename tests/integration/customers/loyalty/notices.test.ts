// Tier downgrade notices: assuming no new sales, the projection finds the day trailing 365-day spend drops below the
// current tier's minimum. `tier_notice_days` before it the customer is told once, by SMS (or email when they have one).
//   sendTierNotice(db, ctx, { customerId, at }) -> { sent, effectiveOn?, from?, to? }   (@shopper/core/customers)
//   accountDue(db, orgId, customerId, now)      -> the notice date (or another due moment), or null
//   The notice is a `tier.notice` notification message { noticeId }, delivered by deliverNotification.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { accountDue, sendTierNotice } from "@shopper/core/customers";
import { deliverNotification } from "@shopper/core/notifications";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { addCustomer } from "../../../support/customers/seed";
import { chainValid } from "../../../support/customers/ledger";
import { freshSale, pushSale } from "../../../support/customers/credit";
import { cashSaleEvent } from "../../../support/customers/loyalty";
import { context, notices, queue, saleAt, setOrg } from "../../../support/customers/due";
import { ids } from "../../../support/till/sales";
import { databases } from "../../../support/till/server";

let world: Awaited<ReturnType<typeof goldenWorld>>;
beforeAll(async () => {
  world = await goldenWorld();
  await setOrg({
    loyalty_enabled: true,
    loyalty_earn_bps: 100,
    loyalty_point_value: 100,
    loyalty_expiry_days: 0,
    tier_notice_days: 14,
    credit_interest_bps: 0,
  });
  await databases().db.execute(sql`
    INSERT INTO loyalty_tier (org_id, name, min_spend, earn_bps) VALUES
      (${ids.org}, 'Gold', 10000000, 300), (${ids.org}, 'Silver', 5000000, 200)`);
  const template = await freshSale();
  const seeder = await addCustomer({ phone: "0271795000" });
  expect((await pushSale(template, cashSaleEvent(template, seeder))).body.accepted).toHaveLength(1);
});
afterAll(async () => world?.local.close());

const db = () => databases().db;
const noticeDay = new Date("2026-11-12T10:00:00Z");
/** GH₵1 000 over the year to date: Gold until the first GH₵500 is a year old on 26 Nov. */
async function goldCustomer(phone: string) {
  const customerId = await addCustomer({ phone });
  await saleAt(customerId, 5_000_000, "2025-11-26T10:00:00Z");
  await saleAt(customerId, 5_000_000, "2026-03-01T10:00:00Z");
  return customerId;
}

test("the notice goes 14 days before the projected downgrade, once, by SMS", async () => {
  const customerId = await goldCustomer("0271795001");
  expect(await accountDue(db(), ids.org, customerId, new Date("2026-10-23T09:00:00Z"))).toEqual(
    noticeDay,
  );
  const early = await sendTierNotice(db(), context, {
    customerId,
    at: new Date("2026-11-11T10:00:00Z"),
  });
  expect(early).toMatchObject({ sent: false });

  const queued = queue();
  const sent = await sendTierNotice(
    db(),
    { ...context, queue: queued },
    { customerId, at: noticeDay },
  );
  expect(sent).toMatchObject({
    sent: true,
    effectiveOn: "2026-11-26",
    from: "Gold",
    to: "Silver",
  });
  expect(
    await sendTierNotice(db(), { ...context, queue: queued }, { customerId, at: noticeDay }),
  ).toMatchObject({ sent: false });
  expect(queued.sent).toHaveLength(1);
  expect(queued.sent[0]).toMatchObject({ type: "tier.notice", orgId: ids.org });
  expect(await accountDue(db(), ids.org, customerId, noticeDay)).toBeNull();

  const texts: { to: string[]; message: string }[] = [];
  const sms = {
    send: async (to: string[], message: string) => (texts.push({ to, message }), "ref-1"),
  } as unknown as Parameters<typeof deliverNotification>[0]["sms"];
  let acked = 0;
  await deliverNotification(
    { db: db(), appVersion: "test", sms },
    {
      message: queued.sent[0]!,
      attempts: 1,
      ack: async () => void acked++,
      retry: async () => {
        throw new Error("the notice should not retry");
      },
    },
  );
  expect(acked).toBe(1);
  expect(texts).toEqual([
    {
      to: ["0271795001"],
      message: expect.stringContaining("Your Gold tier changes to Silver on 26 Nov"),
    },
  ]);
  expect(await notices(customerId)).toMatchObject([
    { effective_on: "2026-11-26", from_tier: "Gold", to_tier: "Silver", channel: "sms" },
  ]);
  expect((await notices(customerId))[0]!.sent_at).not.toBeNull();
  expect(await chainValid()).toBe(true);
});

test("a new sale before the notice date keeps the tier, so no notice is sent", async () => {
  const customerId = await goldCustomer("0271795002");
  await saleAt(customerId, 5_000_000, "2026-11-01T10:00:00Z");
  expect(await sendTierNotice(db(), context, { customerId, at: noticeDay })).toMatchObject({
    sent: false,
  });
  expect(await notices(customerId)).toEqual([]);
  // The projection moves to the day the March sale is a year old: 1 Mar 2027, told on 15 Feb.
  expect(await accountDue(db(), ids.org, customerId, noticeDay)).toEqual(
    new Date("2027-02-15T10:00:00Z"),
  );
});

test("with notice days at 0 nothing is sent and nothing is due", async () => {
  await setOrg({ tier_notice_days: 0 });
  try {
    const customerId = await goldCustomer("0271795003");
    expect(await sendTierNotice(db(), context, { customerId, at: noticeDay })).toMatchObject({
      sent: false,
    });
    expect(await notices(customerId)).toEqual([]);
    expect(
      await accountDue(db(), ids.org, customerId, new Date("2026-10-23T09:00:00Z")),
    ).toBeNull();
  } finally {
    await setOrg({ tier_notice_days: 14 });
  }
});
