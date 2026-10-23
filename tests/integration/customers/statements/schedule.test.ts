// Statements on a schedule: one `statement-schedule` workflow per org (instance id = org id) sleeps until the run day
// (Accra), then queues one message per customer who owes at least the minimum or had activity in the period (the
// previous calendar month); each runs statement.send per channel, so a re-run sends nothing. Box shell, fake clock.
//   boxStatementFlows({ withDatabase, appVersion, queue }) -> WorkflowLauncher & { active(id) }  (@shopper/adapters-box)
//   fanOutStatements(db, ctx, { at }) queues the run for the period before `at`.
//   start(orgId, { orgId, actorId }); a settings change queues `statement.schedule`, which starts or wakes it.
//   GET/PUT /settings/statements { schedule: "off"|"monthly", day: 1-28, channels: ["sms","email"], minBalance }
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { boxQueue, boxStatementFlows } from "@shopper/adapters-box";
import { fanOutStatements } from "@shopper/core/customers";
import { deliverNotification } from "@shopper/core/notifications";
import { NOTIFICATION_RETRY } from "@shopper/ports";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { portalMember, portalOwner, type Portal } from "../../../support/api/portal";
import { addCustomer } from "../../../support/customers/seed";
import { addEntryAt } from "../../../support/customers/ledger";
import { ids } from "../../../support/till/sales";
import { databases } from "../../../support/till/server";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let flows: ReturnType<typeof boxStatementFlows>;
let owner: Portal;
let queue: ReturnType<typeof boxQueue>;
const db = () => databases().db;
beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  // Scheduled messages run statement.send for real; the statement.send deliveries themselves are not sent here.
  queue = boxQueue(NOTIFICATION_RETRY, async (delivery) =>
    delivery.message.type === "statement.send"
      ? delivery.ack()
      : deliverNotification({ db: db(), appVersion: "test" }, delivery),
  );
  flows = boxStatementFlows({ withDatabase: (run) => run(db()), appVersion: "test", queue });
});
afterAll(async () => world?.local.close());
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(new Date("2026-10-23T09:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const until = (iso: string) => vi.advanceTimersByTimeAsync(Date.parse(iso) - Date.now());
const eventually = (check: () => Promise<void>) =>
  vi.waitFor(check, { timeout: 5000, interval: 25 });
const settings = (body: unknown, cookie = owner.cookie) =>
  owner.api.request("/settings/statements", {
    method: body === undefined ? "GET" : "PUT",
    headers: { cookie, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
async function deliveries() {
  const { rows } = await db().execute<{ customer_id: string; channel: string; period: string }>(sql`
    SELECT customer_id, channel, period_from::text || '..' || period_to::text AS period
    FROM statement_delivery WHERE org_id = ${ids.org} ORDER BY customer_id, channel, period_from`);
  return rows.map((row) => [row.customer_id, row.channel, row.period]);
}
const monthly = { schedule: "monthly", day: 5, channels: ["sms", "email"], minBalance: 100_000 };

test("settings are off by default, validated and need customer.manage", async () => {
  vi.useRealTimers();
  expect(await (await settings(undefined)).json()).toEqual({
    schedule: "off",
    day: 1,
    channels: [],
    minBalance: 0,
  });
  for (const bad of [
    { ...monthly, day: 29 },
    { ...monthly, channels: ["pdf"] },
    { ...monthly, channels: [] },
    { ...monthly, minBalance: -1 },
  ])
    expect((await settings(bad)).status).toBe(400);
  expect((await settings(monthly, await portalMember(owner, "cashier"))).status).toBe(403);
});

test("monthly on day 5: customers over the minimum, or with activity, get one delivery per channel", async () => {
  const owes = await addCustomer({ phone: "0271797001" });
  await db().execute(sql`UPDATE customer SET email = 'owes@example.com' WHERE id = ${owes}`);
  await addEntryAt(owes, "charge", 500_000, "2026-10-02T10:00:00Z");
  const small = await addCustomer({ phone: "0271797002" });
  await addEntryAt(small, "charge", 50_000, "2026-08-02T10:00:00Z");
  const settled = await addCustomer({ phone: "0271797003" });
  await addEntryAt(settled, "charge", 200_000, "2026-09-02T10:00:00Z");
  await addEntryAt(settled, "payment", -200_000, "2026-10-12T10:00:00Z");
  await db().execute(sql`
    UPDATE org SET statement_schedule = 'monthly', statement_day = 5, statement_channels = '{sms,email}',
      statement_min_balance = 100000 WHERE id = ${ids.org}`);
  await flows.start(ids.org, { orgId: ids.org, actorId: ids.cashier });

  await vi.advanceTimersByTimeAsync(60_000);
  expect(await deliveries()).toEqual([]);
  await until("2026-11-05T00:00:01Z");
  const october = "2026-10-01..2026-10-31";
  const expected = [
    [owes, "email", october],
    [owes, "sms", october],
    [settled, "sms", october],
  ].sort((a, b) => a.join().localeCompare(b.join()));
  await eventually(async () => expect(await deliveries()).toEqual(expected));

  // Running the period again sends nothing.
  await fanOutStatements(
    db(),
    { orgId: ids.org, appVersion: "test", actorId: ids.cashier, queue },
    { at: new Date("2026-11-05T00:00:00Z") },
  );
  await queue.idle();
  expect(await deliveries()).toEqual(expected);
  expect(flows.active(ids.org)).toBe(true);
});

test("a settings change wakes the flow, and turning the schedule off ends it", async () => {
  vi.setSystemTime(new Date("2026-11-20T09:00:00Z"));
  const late = await addCustomer({ phone: "0271797004" });
  await addEntryAt(late, "charge", 300_000, "2026-11-10T10:00:00Z");
  // Day 3 instead of 5: the flow wakes and runs on 3 Dec for November.
  vi.useRealTimers();
  expect((await settings({ ...monthly, day: 3, channels: ["sms"] })).status).toBe(200);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(new Date("2026-11-20T09:00:00Z"));
  await flows.start(ids.org, { orgId: ids.org, actorId: ids.cashier });
  await until("2026-12-03T00:00:01Z");
  await eventually(async () =>
    expect(await deliveries()).toContainEqual([late, "sms", "2026-11-01..2026-11-30"]),
  );

  vi.useRealTimers();
  expect((await settings({ ...monthly, schedule: "off" })).status).toBe(200);
  await flows.start(ids.org, { orgId: ids.org, actorId: ids.cashier });
  await eventually(async () => expect(flows.active(ids.org)).toBe(false));
});
