// The `customer-account` workflow (instance id = customer id) on the box shell, with a fake clock: it sleeps until the
// next due moment, posts interest, points expiry and tier notices there, ends when nothing is due, and a wake (an
// earn, a charge, a settings change) makes it look again or starts it anew.
//   boxAccountFlows({ withDatabase, appVersion, queue? }) -> WorkflowLauncher & { relaunch() }  (@shopper/adapters-box)
//   start(customerId, { orgId, customerId }) is idempotent: a running flow is sent "wake" instead.
//   An `account.wake` notification { customerId } reaches it through deliverNotification({ accounts }).
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { boxAccountFlows } from "@shopper/adapters-box";
import { deliverNotification } from "@shopper/core/notifications";
import { workflowRun } from "@shopper/db-pg";
import { goldenWorld } from "../../support/sales/golden/setup";
import { addCustomer } from "../../support/customers/seed";
import { addEntryAt, entries } from "../../support/customers/ledger";
import { ON, cashSaleEvent, loyaltyApi, pointEntries } from "../../support/customers/loyalty";
import { freshSale, pushSale } from "../../support/customers/credit";
import { portalOwner } from "../../support/api/portal";
import { sentMessages } from "../../support/stock/queue";
import { pointsAt, setOrg } from "../../support/customers/due";
import { ids } from "../../support/till/sales";
import { databases } from "../../support/till/server";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let flows: ReturnType<typeof boxAccountFlows>;
beforeAll(async () => {
  world = await goldenWorld();
  await setOrg({
    credit_terms_days: 30,
    credit_interest_bps: 200,
    loyalty_enabled: true,
    loyalty_earn_bps: 100,
    loyalty_point_value: 100,
    loyalty_expiry_days: 30,
    tier_notice_days: 0,
  });
  flows = boxAccountFlows({ withDatabase: (run) => run(databases().db), appVersion: "test" });
});
afterAll(async () => world?.local.close());
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(new Date("2026-10-23T09:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const params = (customerId: string) => ({ orgId: ids.org, customerId });
const until = (iso: string) => vi.advanceTimersByTimeAsync(Date.parse(iso) - Date.now());
const eventually = (check: () => Promise<void>) =>
  vi.waitFor(check, { timeout: 5000, interval: 25 });
const kinds = async (customerId: string) => (await entries(customerId)).map((e) => e.kind);
const reasons = async (customerId: string) =>
  (await pointEntries(customerId)).map((e) => [e.reason, e.points]);
const run = async (customerId: string) =>
  (
    await databases()
      .db.select()
      .from(workflowRun)
      .where(and(eq(workflowRun.orgId, ids.org), eq(workflowRun.instanceId, customerId)))
  )[0];
const wake = (customerId: string) =>
  deliverNotification(
    { db: databases().db, appVersion: "test", accounts: flows },
    {
      message: {
        id: v7(),
        orgId: ids.org,
        v: 1,
        sequence: "0",
        type: "account.wake",
        payload: { customerId },
      },
      attempts: 1,
      ack: async () => {},
      retry: async () => {
        throw new Error("a wake should not retry");
      },
    },
  );

test("it sleeps until the next due moment, posts, and ends when nothing is due", async () => {
  const customerId = await addCustomer({ phone: "0271796001" });
  await addEntryAt(customerId, "charge", 1_000_000, "2026-09-01T10:00:00Z");
  await pointsAt(customerId, "earn", 100, "2026-10-10T10:00:00Z");
  await flows.start(customerId, params(customerId));

  await vi.advanceTimersByTimeAsync(60_000);
  expect(await kinds(customerId)).toEqual(["charge"]);
  await until("2026-11-01T00:00:01Z");
  await eventually(async () => expect(await kinds(customerId)).toEqual(["charge", "interest"]));
  expect(await reasons(customerId)).toEqual([["earn", 100]]);

  await until("2026-11-09T10:00:01Z");
  await eventually(async () =>
    expect(await reasons(customerId)).toEqual([
      ["earn", 100],
      ["expire", -100],
    ]),
  );
  // Paid in full before December: the December run finds nothing overdue, and nothing else is due.
  await addEntryAt(customerId, "payment", -1_020_000, "2026-11-20T10:00:00Z");
  await until("2026-12-01T00:00:01Z");
  await eventually(async () =>
    expect(await run(customerId)).toMatchObject({ type: "customer-account", status: "completed" }),
  );
  expect(await kinds(customerId)).toEqual(["charge", "interest", "payment"]);
});

test("an earn wakes a sleeping flow, and a wake starts one that has ended", async () => {
  const customerId = await addCustomer({ phone: "0271796002" });
  await addEntryAt(customerId, "charge", 1_000_000, "2026-09-01T10:00:00Z");
  await flows.start(customerId, params(customerId));
  await vi.advanceTimersByTimeAsync(60_000);

  // Asleep until 1 Nov; a lot earned on 26 Sep lapses on 26 Oct, so the wake brings the flow forward.
  await pointsAt(customerId, "earn", 40, "2026-09-26T10:00:00Z");
  await wake(customerId);
  await until("2026-10-26T10:00:01Z");
  await eventually(async () =>
    expect(await reasons(customerId)).toEqual([
      ["earn", 40],
      ["expire", -40],
    ]),
  );
  expect(await kinds(customerId)).toEqual(["charge"]);

  // Settle up so the flow ends at the November run, then earn again: the wake starts it afresh.
  await addEntryAt(customerId, "payment", -1_000_000, "2026-10-27T10:00:00Z");
  await until("2026-11-01T00:00:01Z");
  await eventually(async () =>
    expect(await run(customerId)).toMatchObject({ status: "completed" }),
  );
  await pointsAt(customerId, "earn", 25, "2026-11-02T10:00:00Z");
  await wake(customerId);
  await until("2026-12-02T10:00:01Z");
  await eventually(async () => expect((await reasons(customerId)).at(-1)).toEqual(["expire", -25]));
});

test("on boot the box relaunches the accounts that have something due", async () => {
  const customerId = await addCustomer({ phone: "0271796003" });
  await pointsAt(customerId, "earn", 10, "2026-10-01T10:00:00Z");
  const booted = boxAccountFlows({
    withDatabase: (run) => run(databases().db),
    appVersion: "test",
  });
  await booted.relaunch();
  await until("2026-10-31T10:00:01Z");
  await eventually(async () =>
    expect(await reasons(customerId)).toEqual([
      ["earn", 10],
      ["expire", -10],
    ]),
  );
});

test("a settings change fans out one wake per affected customer, off the request", async () => {
  const customerId = await addCustomer({ phone: "0271796004" });
  await pointsAt(customerId, "earn", 15, "2026-10-05T10:00:00Z");
  await deliverNotification(
    { db: databases().db, appVersion: "test", accounts: flows },
    {
      message: {
        id: v7(),
        orgId: ids.org,
        v: 1,
        sequence: "0",
        type: "account.settings",
        payload: {},
      },
      attempts: 1,
      ack: async () => {},
      retry: async () => {
        throw new Error("a fan-out should not retry");
      },
    },
  );
  await until("2026-11-04T10:00:01Z");
  await eventually(async () => expect((await reasons(customerId)).at(-1)).toEqual(["expire", -15]));
});

test("a sale to a customer, and loyalty and credit settings changes, queue the wakes after commit", async () => {
  vi.useRealTimers();
  const owner = await portalOwner(ids.org, ids.cashier);
  const customerId = await addCustomer({ phone: "0271796005" });
  const created = await freshSale();
  expect((await pushSale(created, cashSaleEvent(created, customerId))).body.accepted).toHaveLength(
    1,
  );
  expect(
    (await loyaltyApi(owner, owner.cookie).setSettings({ ...ON, expiryDays: 30 })).status,
  ).toBe(200);
  const credit = (body: unknown) =>
    owner.api.request("/settings/credit", {
      method: "PUT",
      headers: { cookie: owner.cookie, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  expect((await credit({ termsDays: 30, interestBps: 10_001 })).status).toBe(400);
  const changed = await credit({ termsDays: 30, interestBps: 200 });
  expect(changed.status).toBe(200);
  expect(await changed.json()).toEqual({ termsDays: 30, interestBps: 200 });
  const sent = await sentMessages();
  expect(sent).toContainEqual(
    expect.objectContaining({ type: "account.wake", orgId: ids.org, payload: { customerId } }),
  );
  const fanOuts = sent.filter((m) => m.type === "account.settings" && m.orgId === ids.org);
  expect(fanOuts.length).toBeGreaterThanOrEqual(2);
});
