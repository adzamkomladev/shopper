import { env, introspectWorkflowInstance } from "cloudflare:test";
import { expect, test } from "vitest";
import { and, asc, eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import { cloudflareDatabase, cloudflareLauncher } from "@shopper/adapters-cf";
import { storeDayId } from "@shopper/core/reports";
import { buildInfo } from "@shopper/config";

const bindings = env as { HYPERDRIVE: Hyperdrive; STORE_DAY: Workflow };
const provision = defineCommand({
  name: "conformance.store_day",
  async run(tx, ctx) {
    await tx.insert(schema.org).values({ id: ctx.orgId, name: "Worker store day" });
    const [store] = await tx
      .insert(schema.store)
      .values({ orgId: ctx.orgId, name: "Osu", opensAt: "06:00", closesAt: "22:00" })
      .returning();
    return { storeId: store!.id };
  },
  audit: (_input, ids) => ids,
});

test("StoreDayWorkflow runs a store's day in workerd and starts the next one", async () => {
  const orgId = v7();
  const connection = await cloudflareDatabase(bindings.HYPERDRIVE.connectionString);
  try {
    const { storeId } = await provision(
      connection.db,
      { orgId, appVersion: buildInfo.version },
      undefined,
    );
    const day = "2026-10-15";
    const id = storeDayId(orgId, storeId, day);
    const nextId = storeDayId(orgId, storeId, "2026-10-16");
    await using today = await introspectWorkflowInstance(bindings.STORE_DAY, id);
    await today.modify(async (modifier) => {
      await modifier.disableSleeps();
    });
    // Tomorrow is started for real; its first step is cut short so the chain stops there.
    await using tomorrow = await introspectWorkflowInstance(bindings.STORE_DAY, nextId);
    await tomorrow.modify(async (modifier) => {
      await modifier.mockStepResult({ name: "open" }, "null");
    });
    await cloudflareLauncher(bindings.STORE_DAY).start(id, { orgId, storeId, day });
    await today.waitForStatus("complete");
    await tomorrow.waitForStatus("complete");

    const [record] = await connection.db
      .select()
      .from(schema.storeDay)
      .where(and(eq(schema.storeDay.orgId, orgId), eq(schema.storeDay.day, day)));
    expect(record).toMatchObject({ status: "closed" });
    expect(record!.rolledAt).toBeInstanceOf(Date);
    const [run] = await connection.db
      .select()
      .from(schema.workflowRun)
      .where(and(eq(schema.workflowRun.orgId, orgId), eq(schema.workflowRun.instanceId, id)));
    expect(run).toMatchObject({ type: "store-day", status: "completed", currentStep: "close" });
    const steps = await connection.db
      .select({ name: schema.workflowStep.name })
      .from(schema.workflowStep)
      .where(eq(schema.workflowStep.instanceId, id))
      .orderBy(asc(schema.workflowStep.createdAt));
    expect(steps.map((s) => s.name)).toEqual([
      "open",
      "opened",
      "reminder",
      "summary",
      "rollup",
      "close",
    ]);
    const [open] = await connection.db
      .select({ output: schema.workflowStep.output })
      .from(schema.workflowStep)
      .where(and(eq(schema.workflowStep.instanceId, id), eq(schema.workflowStep.name, "open")));
    // The day woke by the store's own hours.
    expect(open!.output).toEqual({
      opensAt: "2026-10-15T06:00:00.000Z",
      closesAt: "2026-10-15T22:00:00.000Z",
    });
  } finally {
    await connection.close();
  }
});
