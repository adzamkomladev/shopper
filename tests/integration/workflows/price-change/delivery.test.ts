import { expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { workflowStep } from "@shopper/db-pg";
import { runPriceChange, schedulePrice } from "@shopper/core/catalogue";
import { memoryWorkflow } from "@shopper/ports";
import { auditFor, context, createProduct, db, newStore, realtime } from "./support";

test("realtime retries its own step after a committed price step and reuses its envelope", async () => {
  await newStore();
  const product = await createProduct();
  const start = new Date(Date.now() + 1000);
  const end = new Date(start.getTime() + 1000);
  const scheduled = await schedulePrice(db, context, {
    productId: product.id,
    data: { amount: 7000, startsAt: start.toISOString(), endsAt: end.toISOString() },
    launch: async () => {},
  });
  const ids: string[] = [];
  let failures = 0;
  const flow = memoryWorkflow(scheduled.workflowId);
  const deps = {
    withDatabase: async <T>(run: (database: typeof db) => Promise<T>) => run(db),
    appVersion: context.appVersion,
    realtime: {
      ...realtime,
      async publish(
        orgId: string,
        storeId: string,
        message: Parameters<typeof realtime.publish>[2],
      ) {
        expect(await auditFor("price.publish", scheduled.price.id)).not.toHaveLength(0);
        if ((message.payload as { phase: string }).phase === "start") {
          ids.push(message.id);
          if (failures++ === 0) throw new Error("Transport interrupted");
        }
        return realtime.publish(orgId, storeId, message);
      },
    },
  };
  const params = {
    orgId: context.orgId,
    priceId: scheduled.price.id,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
  };
  await runPriceChange(flow, deps, params);
  expect(ids[0]).toBe(ids[1]);
  const steps = await db
    .select({ name: workflowStep.name })
    .from(workflowStep)
    .where(eq(workflowStep.instanceId, scheduled.workflowId));
  expect(steps.map((step) => step.name).sort()).toEqual([
    "notify-end",
    "notify-start",
    "publish-end",
    "publish-start",
    "schedule",
  ]);
  expect(await auditFor("price.publish", scheduled.price.id)).toHaveLength(2);
  const delivered = ids.length;
  await runPriceChange(flow, deps, params);
  expect(ids).toHaveLength(delivered);
  expect(await auditFor("price.publish", scheduled.price.id)).toHaveLength(2);
});
