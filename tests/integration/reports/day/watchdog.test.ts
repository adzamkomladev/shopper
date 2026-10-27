// The one daily watchdog starts every org's audit anchor and every store's day for today and tomorrow, so a chain
// that died picks up again; on the box the store days run in process and restart on boot.
import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { auditLog, store, workflowRun } from "@shopper/db-pg";
import { boxStoreDays } from "@shopper/adapters-box";
import { auditAnchorId } from "@shopper/core/audit";
import { runWatchdog, storeDayId } from "@shopper/core/reports";
import { ids } from "../../../fixtures/sales/golden";
import { notifications } from "../../../support/stock/queue";
import { dayWorld, recordingLauncher } from "../../../support/reports/day";

let w: Awaited<ReturnType<typeof dayWorld>>;
beforeAll(async () => {
  w = await dayWorld();
}, 300_000);
afterAll(async () => {
  await w?.world.local.close();
});

test("at 23:59 it starts each org's anchor and each store's today and tomorrow, and the same again is harmless", async () => {
  const anchors = recordingLauncher();
  const days = recordingLauncher();
  const fire = () =>
    runWatchdog(
      {
        withDatabase: (run) => run(w.world.db),
        anchors: anchors.launcher,
        storeDays: days.launcher,
      },
      new Date("2026-10-26T23:59:00.000Z"),
    );
  await fire();
  const stores = await w.world.db.select({ orgId: store.orgId, id: store.id }).from(store);
  expect(days.started.map((s) => s.id).sort()).toEqual(
    stores
      .flatMap((s) => ["2026-10-26", "2026-10-27"].map((day) => storeDayId(s.orgId, s.id, day)))
      .sort(),
  );
  expect(days.started).toContainEqual({
    id: storeDayId(ids.org, ids.store, "2026-10-27"),
    params: { orgId: ids.org, storeId: ids.store, day: "2026-10-27" },
  });
  expect(anchors.started.map((s) => s.id)).toContain(auditAnchorId(ids.org, "2026-10-26"));
  // A second firing asks for the same ids; the engines treat an existing id as a no-op.
  await fire();
  expect(new Set(days.started.map((s) => s.id)).size).toBe(days.started.length / 2);
});

test("the box runs a store day in process: one run per id, and on boot every store's day starts again", async () => {
  const box = boxStoreDays({ database: w.world.db, queue: notifications });
  // A day ahead: it opens its record and then sleeps until opening, so nothing else happens in this test.
  const day = "2030-01-02";
  await box.relaunch(new Date(`${day}T00:00:00.000Z`));
  await box.launcher.start(storeDayId(ids.org, ids.store, day), {
    orgId: ids.org,
    storeId: ids.store,
    day,
  });
  const id = storeDayId(ids.org, ids.store, day);
  await vi.waitFor(async () => {
    const [run] = await w.world.db.select().from(workflowRun).where(eq(workflowRun.instanceId, id));
    expect(run).toMatchObject({ type: "store-day", currentStep: "open", status: "waiting" });
  });
  const opened = await w.world.db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.orgId, ids.org), eq(auditLog.command, "store-day.open")));
  expect(opened.filter((row) => JSON.stringify(row).includes(day))).toHaveLength(1);
  // A restart the next day: the unfinished day comes back alongside the new one.
  const restarted = boxStoreDays({ database: w.world.db, queue: notifications });
  const relaunched = await restarted.relaunch(new Date("2030-01-03T00:01:00.000Z"));
  expect(relaunched).toContain(id);
  expect(relaunched).toContain(storeDayId(ids.org, ids.store, "2030-01-03"));
  // Finished days stay finished.
  expect(
    relaunched.filter(
      (started) => started.endsWith("2030-01-02") || started.endsWith("2030-01-03"),
    ),
  ).toEqual(relaunched);
  await expect(
    box.launcher.start("store-day_bad id", { orgId: ids.org, storeId: ids.store, day }),
  ).rejects.toThrow();
  await expect(box.launcher.start(id, { orgId: ids.org })).rejects.toThrow();
});
