// Day 43: while a cloud shop moves onto its own box, and for good once it has, the cloud's own workflows leave it
// alone. Store days, billing, audit anchors and settlements would otherwise write rows its archive does not hold
// and the box's report would disagree. Calling the move off lets the next watchdog pick everything up again.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { billingId, runBilling } from "@shopper/core/billing";
import { runStoreDay, runWatchdog, storeDayId } from "@shopper/core/reports";
import * as schema from "@shopper/db-pg";
import { memoryWorkflow } from "@shopper/ports";
import { ids } from "../../fixtures/sales/golden";
import { dayWorld, recordingLauncher } from "../../support/reports/day";
import { notifications } from "../../support/stock/queue";
import { appVersion } from "../../support/till/server/data";

let w: Awaited<ReturnType<typeof dayWorld>>;
beforeAll(async () => {
  w = await dayWorld();
}, 300_000);
afterAll(async () => {
  await w?.world.local.close();
});

const DAY = 86_400_000;
const today = new Date().toISOString().slice(0, 10);
const moving = (status: "open" | "claimed" | "archived" | "cancelled") =>
  w.world.db
    .insert(schema.boxMove)
    .values({ orgId: ids.org, status, exportJobId: v7() })
    .onConflictDoUpdate({ target: schema.boxMove.orgId, set: { status } });
const db = <T>(run: (database: typeof w.world.db) => Promise<T>) => run(w.world.db);

test("the watchdog starts nothing for a shop that is moving, and everything again once the move is called off", async () => {
  await w.world.db
    .insert(schema.subscription)
    .values({ orgId: ids.org, billingDay: 1, nextInvoiceOn: today })
    .onConflictDoUpdate({ target: schema.subscription.orgId, set: { nextInvoiceOn: today } });
  const fire = async () => {
    const launchers = {
      anchors: recordingLauncher(),
      storeDays: recordingLauncher(),
      settlements: recordingLauncher(),
      billing: recordingLauncher(),
    };
    await runWatchdog(
      {
        withDatabase: db,
        anchors: launchers.anchors.launcher,
        storeDays: launchers.storeDays.launcher,
        settlements: launchers.settlements.launcher,
        billing: launchers.billing.launcher,
      },
      new Date(),
    );
    return Object.values(launchers).flatMap((each) =>
      each.started.filter((started) => started.id.includes(ids.org)),
    );
  };
  await moving("open");
  expect(await fire()).toEqual([]);
  await moving("archived");
  expect(await fire()).toEqual([]);
  await moving("cancelled");
  const started = (await fire()).map((each) => each.id);
  expect(started).toContain(storeDayId(ids.org, ids.store, today));
  expect(started).toContain(billingId(ids.org, today));
});

test("a store day already running stops writing once its shop is moving", async () => {
  await moving("claimed");
  const day = "2026-10-20";
  const next = recordingLauncher();
  await runStoreDay(
    memoryWorkflow(storeDayId(ids.org, ids.store, day)),
    { withDatabase: db, appVersion, queue: notifications, storeDays: next.launcher },
    { orgId: ids.org, storeId: ids.store, day },
  );
  const record = await w.world.db
    .select()
    .from(schema.storeDay)
    .where(and(eq(schema.storeDay.orgId, ids.org), eq(schema.storeDay.day, day)));
  expect(record).toEqual([]);
  expect(next.started).toEqual([]);
});

test("a billing period that falls due mid-move raises no invoice while it lasts, and none once the shop has moved", async () => {
  const run = async (periodStart: string, onSleep = (_name: string) => Promise.resolve()) => {
    const flow = memoryWorkflow(billingId(ids.org, periodStart));
    await runBilling(
      {
        ...flow,
        sleepUntil: (name, at) => onSleep(name).then(() => flow.sleepUntil(name, at)),
      },
      {
        withDatabase: db,
        appVersion: "test",
        queue: notifications,
      },
      { orgId: ids.org, periodStart },
    );
    return w.world.db
      .select()
      .from(schema.invoice)
      .where(and(eq(schema.invoice.orgId, ids.org), eq(schema.invoice.periodStart, periodStart)));
  };
  await moving("open");
  const moved = (name: string) =>
    name === "moving-3" ? moving("archived").then(() => {}) : Promise.resolve();
  expect(await run(new Date(Date.now() - 20 * DAY).toISOString().slice(0, 10), moved)).toEqual([]);
  expect(await run(new Date(Date.now() - 40 * DAY).toISOString().slice(0, 10))).toEqual([]);
  // Called off: the period is raised as usual.
  await moving("cancelled");
  expect(await run(new Date(Date.now() - 60 * DAY).toISOString().slice(0, 10))).toHaveLength(1);
  // A move left open for weeks still bills once it is called off, so the next period can follow.
  await moving("open");
  const late = (name: string) =>
    name === "moving-20" ? moving("cancelled").then(() => {}) : Promise.resolve();
  expect(await run(new Date(Date.now() - 80 * DAY).toISOString().slice(0, 10), late)).toHaveLength(
    1,
  );
});
