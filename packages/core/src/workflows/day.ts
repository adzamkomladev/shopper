import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import type { WorkflowCheckpoint } from "@shopper/audit";
import { branch } from "@shopper/db-pg";
import type { Workflow } from "@shopper/ports";
import { dashboard } from "../reports/dashboard";
import {
  closeStoreDay,
  markStoreDayOpen,
  openStoreDay,
  remindStoreDay,
  storeDayId,
  summarizeStoreDay,
} from "../reports/day/steps";
import { rollStoreDays } from "../reports/rollup";
import { storeDayParams } from "../schemas/reports/day";
import type { StoreDayDeps } from "./types";

const policy = { maxAttempts: 5, delayMs: 1000, backoff: "exponential" } as const;
/** The night's rollup waits until five past midnight, so the whole day is in. */
const NIGHT_MS = 24 * 3_600_000 + 5 * 60_000;

/**
 * One store's trading day: open its record and fix its hours, wake at opening, at closing remind the owners of
 * registers still without a Z and send them the day's figures, roll the day up after midnight, close the record and
 * start tomorrow. Every step is a checkpointed command, so a rerun sends and writes nothing twice.
 */
export async function runStoreDay(
  flow: Pick<Workflow, "instanceId" | "step" | "sleepUntil">,
  deps: StoreDayDeps,
  raw: unknown,
) {
  const params = v.parse(storeDayParams, raw);
  if (flow.instanceId !== storeDayId(params.orgId, params.storeId, params.day))
    throw new Error("Store day instance must be its store-day key");
  const day = { storeId: params.storeId, day: params.day };
  const context = { orgId: params.orgId, appVersion: deps.appVersion, queue: deps.queue };
  const checkpoint = (step: string, status: WorkflowCheckpoint["status"] = "waiting") => ({
    instanceId: flow.instanceId,
    businessKey: flow.instanceId,
    type: "store-day",
    step,
    status,
  });

  const hours = await flow.step("open", policy, () =>
    deps.withDatabase((db) => openStoreDay(db, context, day, checkpoint("open"))),
  );
  if (!hours) return;
  await flow.sleepUntil("opening", new Date(hours.opensAt));
  await flow.step("opened", policy, () =>
    deps.withDatabase((db) => markStoreDayOpen(db, context, day, checkpoint("opened"))),
  );
  await flow.sleepUntil("closing", new Date(hours.closesAt));
  await flow.step("reminder", policy, () =>
    deps.withDatabase((db) => remindStoreDay(db, context, day, checkpoint("reminder"))),
  );
  await flow.step("summary", policy, () =>
    deps.withDatabase(async (db) => {
      const branches = await db
        .select({ id: branch.id })
        .from(branch)
        .where(and(eq(branch.orgId, params.orgId), eq(branch.storeId, params.storeId)));
      const figures = await dashboard(
        db,
        params.orgId,
        { day: params.day },
        branches.map((row) => row.id),
      );
      const summary = { kpis: figures.kpis, top: figures.top, tenders: figures.tenders };
      return summarizeStoreDay(db, context, { ...day, summary }, checkpoint("summary"));
    }),
  );
  await flow.sleepUntil("night", new Date(Date.parse(`${params.day}T00:00:00.000Z`) + NIGHT_MS));
  await flow.step("rollup", policy, () =>
    deps.withDatabase((db) =>
      rollStoreDays(
        db,
        context,
        { storeId: params.storeId, through: params.day },
        checkpoint("rollup", "running"),
      ),
    ),
  );
  await flow.step("close", policy, () =>
    deps.withDatabase((db) => closeStoreDay(db, context, day, checkpoint("close", "completed"))),
  );
  const tomorrow = new Date(Date.parse(`${params.day}T00:00:00.000Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
  await flow.step("next", policy, async () => {
    await deps.storeDays.start(storeDayId(params.orgId, params.storeId, tomorrow), {
      orgId: params.orgId,
      storeId: params.storeId,
      day: tomorrow,
    });
    return { day: tomorrow };
  });
}
