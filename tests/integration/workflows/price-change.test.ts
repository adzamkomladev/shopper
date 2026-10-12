import { expect, test } from "vite-plus/test";
import {
  auditFor,
  call,
  callWithoutLauncher,
  context,
  createProduct,
  db,
  expectChainValid,
  newStore,
  postOk,
  runOf,
  schedule,
  scheduleOk,
  unique,
  waitForPhases,
  waitForRun,
  watch,
} from "./price-change-support";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { otherApi, cookies, request } from "../catalogue/support";
import { otherContext } from "../auth/setup";

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const productWithBase = async () => {
  const product = await createProduct();
  const base = await call(`/products/${product.id}/prices`, "POST", {
    amount: 10000,
    validFrom: "2026-01-01T00:00:00Z",
    reason: "Base price",
  });
  expect(base.status).toBe(201);
  return product;
};
const amountNow = async (productId: string) =>
  (
    (await (
      await call(
        `/prices/at?productId=${productId}&at=${encodeURIComponent(new Date().toISOString())}`,
      )
    ).json()) as { amount: number }
  ).amount;

test("scheduling returns the price-change workflow and one price.schedule audit row with the reason", async () => {
  const product = await productWithBase();
  const reason = unique("Easter promotion");
  const scheduled = await scheduleOk(product.id, { reason });
  expect(scheduled.workflowId).toBe(`price-change_${context.orgId}_${scheduled.price.id}`);
  expect(scheduled.price).toMatchObject({ amount: 7000, branchId: null, reason });
  expect(Date.parse(scheduled.price.validFrom)).toBe(Date.parse(scheduled.startsAt));
  expect(Date.parse(scheduled.price.validTo)).toBe(Date.parse(scheduled.endsAt));
  const rows = await auditFor("price.schedule", scheduled.price.id);
  expect(rows).toHaveLength(1);
  expect(rows[0]!.reason).toBe(reason);
  await waitForRun(scheduled.workflowId, "completed");
});

test("at the start every store of the org hears price.changed and a store of another org hears nothing", async () => {
  const [one, two] = [await newStore(), await newStore()];
  const foreign = (await (
    await request(otherApi, cookies.get("other")!, "/stores", "POST", { name: unique("Foreign") })
  ).json()) as { id: string };
  const [heardOne, heardTwo, heardForeign] = [
    await watch(context.orgId, one),
    await watch(context.orgId, two),
    await watch(otherContext.orgId, foreign.id),
  ];
  const product = await productWithBase();
  const scheduled = await scheduleOk(product.id);
  await waitForPhases(heardOne, ["start"]);
  await waitForPhases(heardTwo, ["start"]);
  expect(heardOne[0]).toMatchObject({
    orgId: context.orgId,
    v: 1,
    type: "price.changed",
    payload: {
      priceId: scheduled.price.id,
      productId: product.id,
      branchId: null,
      phase: "start",
      amount: 7000,
    },
  });
  // The reason is back-office history; devices never need it.
  expect(heardOne[0]!.payload).not.toHaveProperty("reason");
  expect(heardOne[0]!.id).toMatch(UUID_V7);
  expect(heardOne[0]!.sequence).toMatch(/^\d+$/);
  const payload = heardOne[0]!.payload as { validFrom: string; validTo: string };
  expect(Date.parse(payload.validFrom)).toBe(Date.parse(scheduled.startsAt));
  expect(Date.parse(payload.validTo)).toBe(Date.parse(scheduled.endsAt));
  await waitForRun(scheduled.workflowId, "completed");
  expect(heardForeign).toEqual([]);
});

test("the scheduled amount applies during the window, the previous price returns after it, and stores hear the end", async () => {
  const heard = await watch(context.orgId, await newStore());
  const product = await productWithBase();
  const scheduled = await scheduleOk(product.id);
  await waitForPhases(heard, ["start"]);
  expect(await amountNow(product.id)).toBe(7000);
  await waitForPhases(heard, ["start", "end"]);
  expect((heard[1]!.payload as { priceId: string }).priceId).toBe(scheduled.price.id);
  expect(await amountNow(product.id)).toBe(10000);
});

test("a branch-scoped schedule reaches only the store of that branch", async () => {
  const [storeA, storeB] = [await newStore(), await newStore()];
  const [heardA, heardB] = [await watch(context.orgId, storeA), await watch(context.orgId, storeB)];
  const branch = await postOk("/branches", { name: unique("Window branch"), storeId: storeA });
  const product = await productWithBase();
  const scheduled = await scheduleOk(product.id, { branchId: branch.id });
  expect(scheduled.price.branchId).toBe(branch.id);
  await waitForPhases(heardA, ["start", "end"]);
  await waitForRun(scheduled.workflowId, "completed");
  expect(heardA[0]!.payload).toMatchObject({ branchId: branch.id, phase: "start" });
  expect(heardB).toEqual([]);
});

test("each publish step records the workflow run, its steps and an audited price.publish", async () => {
  const product = await productWithBase();
  const { response, startsAt } = await schedule(product.id, {}, { startMs: 400, windowMs: 400 });
  expect(response.status).toBe(201);
  const scheduled = (await response.json()) as { price: { id: string }; workflowId: string };
  await waitForRun(scheduled.workflowId, "waiting");
  expect(await runOf(scheduled.workflowId)).toMatchObject({
    type: "price-change",
    businessKey: scheduled.workflowId,
  });
  expect(Date.now()).toBeLessThan(Date.parse(startsAt));
  await waitForRun(scheduled.workflowId, "completed");
  const steps = await db
    .select()
    .from(schema.workflowStep)
    .where(eq(schema.workflowStep.instanceId, scheduled.workflowId));
  expect(steps.map((step) => step.name).sort()).toEqual([
    "publish-end",
    "publish-start",
    "schedule",
  ]);
  const published = await auditFor("price.publish", scheduled.price.id);
  expect(published).toHaveLength(2);
  expect(published.map((row) => row.entity)).toEqual(["price", "price"]);
  await expectChainValid();
});

test("a role without product.write cannot schedule and an API without a launcher answers 503", async () => {
  const product = await productWithBase();
  const forbidden = await schedule(product.id, {}, { role: "cashier" });
  expect(forbidden.response.status).toBe(403);
  const startsAt = new Date(Date.now() + 60_000).toISOString();
  const endsAt = new Date(Date.now() + 120_000).toISOString();
  const unavailable = await callWithoutLauncher(`/products/${product.id}/prices/schedule`, "POST", {
    amount: 7000,
    startsAt,
    endsAt,
    reason: "No launcher",
  });
  expect(unavailable.status).toBe(503);
});
