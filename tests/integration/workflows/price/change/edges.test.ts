import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { priceChangeId } from "@shopper/core/catalogue";
import {
  auditFor,
  context,
  createProduct,
  db,
  launcher,
  newStore,
  phases,
  runOf,
  schedule,
  scheduleOk,
  waitForPhases,
  waitForRun,
  watch,
} from "./support";
import * as schema from "@shopper/db-pg";
import { eq } from "drizzle-orm";

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const at = (ms: number) => new Date(Date.now() + ms).toISOString();

test("a window that has already started is accepted and announced at once", async () => {
  const product = await createProduct();
  const heard = await watch(context.orgId, await newStore());
  const started = Date.now();
  await scheduleOk(product.id, { startsAt: at(-60_000), endsAt: at(400) });
  await waitForPhases(heard, ["start"]);
  expect(Date.now() - started).toBeLessThan(1000);
  await waitForPhases(heard, ["start", "end"]);
});

test("a window that ends before it starts, or is already over, is rejected and writes nothing", async () => {
  const product = await createProduct();
  const rows = async () =>
    (await db.select().from(schema.price).where(eq(schema.price.productId, product.id))).length;
  for (const [startMs, endMs] of [
    [1000, 1000],
    [2000, 1000],
    [-120_000, -60_000],
  ] as const) {
    const now = Date.now();
    const { response } = await schedule(product.id, {
      startsAt: new Date(now + startMs).toISOString(),
      endsAt: new Date(now + endMs).toISOString(),
    });
    expect(response.status).toBe(400);
  }
  expect(await rows()).toBe(0);
  expect((await auditFor("price.schedule", product.id)).length).toBe(0);
});

test("starting the same workflow twice announces each phase once", async () => {
  const product = await createProduct();
  const heard = await watch(context.orgId, await newStore());
  const scheduled = await scheduleOk(product.id);
  await launcher.start(scheduled.workflowId, {
    orgId: context.orgId,
    priceId: scheduled.price.id,
    startsAt: at(0),
    endsAt: at(100),
  });
  await waitForRun(scheduled.workflowId, "completed");
  await settle(200);
  expect(phases(heard)).toEqual(["start", "end"]);
});

test("instance ids that Cloudflare would refuse are refused on the box too", async () => {
  const params = { orgId: context.orgId, priceId: v7(), startsAt: at(0), endsAt: at(100) };
  await expect(
    launcher.start(`price-change:${context.orgId}:${params.priceId}`, params),
  ).rejects.toThrow();
  await expect(launcher.start("p".repeat(101), params)).rejects.toThrow();
});

test("a schedule weeks away does not fire early (timer overflow guard)", async () => {
  const product = await createProduct();
  const heard = await watch(context.orgId, await newStore());
  const month = 30 * 24 * 60 * 60 * 1000;
  const scheduled = await scheduleOk(product.id, {
    startsAt: at(month),
    endsAt: at(month + 60_000),
  });
  await settle(1000);
  expect(heard).toEqual([]);
  expect(await runOf(scheduled.workflowId)).toMatchObject({ status: "waiting" });
});

test("a launch whose price was never committed ends at once without telling any store", async () => {
  const heard = await watch(context.orgId, await newStore());
  const priceId = v7();
  const workflowId = priceChangeId(context.orgId, priceId);
  await launcher.start(workflowId, {
    orgId: context.orgId,
    priceId,
    startsAt: at(0),
    endsAt: at(3_600_000),
  });
  await waitForRun(workflowId, "completed");
  expect((await runOf(workflowId))!.currentStep).toBe("abandoned");
  expect(heard).toEqual([]);
});
