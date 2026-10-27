// One store's trading day as a workflow: open the record with the store's hours, wake at opening, at closing remind
// the owners of registers that sold without sending a Z, keep and send the day's figures, roll the day up after
// midnight, close the record and start tomorrow. Every step is a checkpointed command: a rerun on an engine that
// forgot everything (a restarted box) writes, audits and sends nothing more.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, asc, eq } from "drizzle-orm";
import { storeDay, workflowRun, workflowStep } from "@shopper/db-pg";
import { memoryWorkflow, type Workflow } from "@shopper/ports";
import { runStoreDay, storeDayId } from "@shopper/core/reports";
import { ids } from "../../../fixtures/sales/golden";
import { notifications, sentMessages } from "../../../support/stock/queue";
import { appVersion } from "../../../support/till/server/data";
import { commandsRun, dayWorld, recordingLauncher } from "../../../support/reports/day";

let w: Awaited<ReturnType<typeof dayWorld>>;
beforeAll(async () => {
  w = await dayWorld();
}, 300_000);
afterAll(async () => {
  await w?.world.local.close();
});

const params = (day: string) => ({ orgId: ids.org, storeId: ids.store, day });
const deps = (storeDays = recordingLauncher().launcher) => ({
  withDatabase: <T>(run: (db: typeof w.world.db) => Promise<T>) => run(w.world.db),
  appVersion,
  queue: notifications,
  storeDays,
});
const record = async (day: string) =>
  (
    await w.world.db
      .select()
      .from(storeDay)
      .where(
        and(eq(storeDay.orgId, ids.org), eq(storeDay.storeId, ids.store), eq(storeDay.day, day)),
      )
  )[0];
const sent = async (type: string, day: string) =>
  (await sentMessages()).filter(
    (m) => m.type === type && (m.payload as { day: string }).day === day,
  );

test("15 Oct runs in order: reminder for the till without a Z, the summary, the rollup, closed, 16 Oct started", async () => {
  const id = storeDayId(ids.org, ids.store, "2026-10-15");
  const next = recordingLauncher();
  await runStoreDay(memoryWorkflow(id), deps(next.launcher), params("2026-10-15"));

  const day = await record("2026-10-15");
  expect(day).toMatchObject({ status: "closed" });
  expect(day!.openedAt).toBeInstanceOf(Date);
  expect(day!.closedAt!.getTime()).toBeGreaterThanOrEqual(day!.openedAt!.getTime());
  expect(day!.rolledAt).toBeInstanceOf(Date);
  const summary = day!.summary as {
    kpis: { netSales: { value: number }; transactions: { value: number } };
  };
  expect(summary.kpis.transactions.value).toBe(1);
  expect(summary.kpis.netSales.value).toBe(120_000);

  const owner = w.owner.principal.userId;
  const reminders = await sent("store-day.reminder", "2026-10-15");
  expect(reminders.map((m) => m.payload)).toEqual([
    { storeId: ids.store, day: "2026-10-15", userId: owner, registers: [expect.any(String)] },
  ]);
  expect((await sent("store-day.summary", "2026-10-15")).map((m) => m.payload)).toEqual([
    { storeId: ids.store, day: "2026-10-15", userId: owner },
  ]);

  const [run] = await w.world.db.select().from(workflowRun).where(eq(workflowRun.instanceId, id));
  expect(run).toMatchObject({ type: "store-day", status: "completed", currentStep: "close" });
  const steps = await w.world.db
    .select({ name: workflowStep.name })
    .from(workflowStep)
    .where(eq(workflowStep.instanceId, id))
    .orderBy(asc(workflowStep.createdAt));
  expect(steps.map((s) => s.name)).toEqual([
    "open",
    "opened",
    "reminder",
    "summary",
    "rollup",
    "close",
  ]);
  expect(await commandsRun(w.world.db, "store-day.")).toEqual([
    "store-day.open",
    "store-day.opened",
    "store-day.reminder",
    "store-day.summary",
    "report.rollup",
    "store-day.close",
  ]);
  expect(next.started).toEqual([
    { id: storeDayId(ids.org, ids.store, "2026-10-16"), params: params("2026-10-16") },
  ]);
});

test("rerun on an engine that forgot everything: nothing is written, audited or sent twice", async () => {
  const id = storeDayId(ids.org, ids.store, "2026-10-15");
  const before = await commandsRun(w.world.db, "store-day.");
  const messages = (await sentMessages()).length;
  const forgetful: Pick<Workflow, "instanceId" | "step" | "sleepUntil"> = {
    instanceId: id,
    step: (_name, _policy, run) => run(),
    sleepUntil: async () => undefined,
  };
  const next = recordingLauncher();
  await runStoreDay(forgetful, deps(next.launcher), params("2026-10-15"));
  expect(await commandsRun(w.world.db, "store-day.")).toEqual(before);
  expect((await sentMessages()).length).toBe(messages);
  // Starting tomorrow again is harmless: an existing id is a no-op on both engines.
  expect(next.started.map((s) => s.id)).toEqual([storeDayId(ids.org, ids.store, "2026-10-16")]);
});

test("14 Oct: the till sent its Z after its last sale, so no reminder goes out; the summary still does", async () => {
  await runStoreDay(
    memoryWorkflow(storeDayId(ids.org, ids.store, "2026-10-14")),
    deps(),
    params("2026-10-14"),
  );
  expect(await sent("store-day.reminder", "2026-10-14")).toEqual([]);
  expect(await sent("store-day.summary", "2026-10-14")).toHaveLength(1);
  expect(await record("2026-10-14")).toMatchObject({ status: "closed" });
});

test("the store's hours on the day are when the flow wakes; a wrong instance id is refused", async () => {
  const waits: [string, string][] = [];
  const flow: Pick<Workflow, "instanceId" | "step" | "sleepUntil"> = {
    instanceId: storeDayId(ids.org, ids.store, "2026-10-13"),
    step: (_name, _policy, run) => run(),
    sleepUntil: async (name, at) => void waits.push([name, at.toISOString()]),
  };
  await runStoreDay(flow, deps(), params("2026-10-13"));
  expect(waits).toEqual([
    ["opening", "2026-10-13T07:00:00.000Z"],
    ["closing", "2026-10-13T21:00:00.000Z"],
    ["night", "2026-10-14T00:05:00.000Z"],
  ]);
  await expect(
    runStoreDay(
      { ...flow, instanceId: storeDayId(ids.org, ids.store, "2026-10-12") },
      deps(),
      params("2026-10-13"),
    ),
  ).rejects.toThrow(/store-day key/);
});
