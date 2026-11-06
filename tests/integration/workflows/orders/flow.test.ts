// Day 32 online order workflow skeleton (instance id = order id), on the portable engine:
//   held -> wait `payment.settled` until the hold expires -> paid -> wait `store.accepted` -> accepted
// No payment in time: the order expires and its stock comes back. Each step writes its table, an audit row and
// workflow_run in one transaction.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { Pool } from "pg";
import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
import { runOnlineOrder } from "@shopper/core/orders";
import { memoryWorkflow } from "@shopper/ports";
import { migrateDatabase } from "../../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../../tooling/database/seed";
import { postgresFixture } from "../../../fixtures/postgres";
import { holdWorld } from "../../../support/orders/holds";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let db: schema.ShopperDatabase;
let orgId: string;
let world: Awaited<ReturnType<typeof holdWorld>>;
beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  await migrateDatabase(db);
  const context = provisioningContext();
  await provisionOrg(db, context, { name: "Order flow" });
  orgId = context.orgId;
  world = await holdWorld(db, orgId);
});
afterAll(async () => {
  await pool?.end();
  await fixture?.close();
});

const deps = {
  withDatabase: <T>(run: (db: schema.ShopperDatabase) => Promise<T>) => run(db),
  appVersion: "test",
};
const order = async (id: string) =>
  (await db.select().from(schema.onlineOrder).where(eq(schema.onlineOrder.id, id)))[0]!;
const run = async (id: string) =>
  (
    await db
      .select()
      .from(schema.workflowRun)
      .where(and(eq(schema.workflowRun.orgId, orgId), eq(schema.workflowRun.instanceId, id)))
  )[0];
/** The audit actions recorded for one order's flow, oldest first. */
const audits = async (id: string) =>
  (
    await db
      .select({ command: schema.auditLog.command })
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.orgId, orgId), eq(schema.auditLog.entityId, id)))
      .orderBy(asc(schema.auditLog.chainSeq))
  ).map((row) => row.command);

test("an order nobody pays for expires when its hold does, and its stock comes back", async () => {
  const seeded = await world.seed(db, world.branchId, 300);
  await runOnlineOrder(memoryWorkflow(seeded.orderId), deps, { orgId, id: seeded.orderId });
  expect((await order(seeded.orderId)).status).toBe("expired");
  expect(await world.released(db, seeded.orderId)).toBe("expired");
  expect(await run(seeded.orderId)).toMatchObject({
    type: "online-order",
    currentStep: "expired",
    status: "completed",
  });
  expect(await audits(seeded.orderId)).toEqual(["order.held", "order.expired"]);
});

test("a settled payment moves the order on to wait for the store, which accepts it", async () => {
  const seeded = await world.seed(db, world.branchId, 60_000);
  const flow = memoryWorkflow(seeded.orderId);
  const running = runOnlineOrder(flow, deps, { orgId, id: seeded.orderId });
  await expect.poll(async () => (await run(seeded.orderId))?.currentStep).toBe("held");
  expect((await run(seeded.orderId))?.status).toBe("waiting");
  await flow.send(seeded.orderId, "payment.settled", { reference: "test" });
  await expect.poll(async () => (await order(seeded.orderId)).status).toBe("paid");
  expect(await run(seeded.orderId)).toMatchObject({ currentStep: "paid", status: "waiting" });
  // Paid stock stays held: the store has yet to pick it.
  expect(await world.released(db, seeded.orderId)).toBeNull();
  await flow.send(seeded.orderId, "store.accepted", {});
  await running;
  expect((await order(seeded.orderId)).status).toBe("accepted");
  expect(await run(seeded.orderId)).toMatchObject({ currentStep: "accepted", status: "completed" });
  expect(await audits(seeded.orderId)).toEqual(["order.held", "order.paid", "order.accepted"]);
});

test("the run refuses an instance id that is not its order", async () => {
  const seeded = await world.seed(db, world.branchId, 60_000);
  await expect(
    runOnlineOrder(memoryWorkflow(crypto.randomUUID()), deps, { orgId, id: seeded.orderId }),
  ).rejects.toThrow(/business key/);
});
