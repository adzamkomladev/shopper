import { env, introspectWorkflow } from "cloudflare:test";
import { expect, test } from "vitest";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import { cloudflareDatabase, cloudflareLauncher, cloudflareRealtime } from "@shopper/adapters-cf";
import { schedulePrice } from "@shopper/core/catalogue";
import { buildInfo } from "@shopper/config";
import type { Envelope } from "@shopper/ports";

const bindings = env as {
  HYPERDRIVE: Hyperdrive;
  PRICE_CHANGE: Workflow;
  STORE_HUB: DurableObjectNamespace<import("@shopper/adapters-cf/coordination").StoreHub>;
};
const provision = defineCommand({
  name: "conformance.catalogue",
  async run(tx, ctx) {
    await tx.insert(schema.org).values({ id: ctx.orgId, name: "Worker price change" });
    const [store] = await tx
      .insert(schema.store)
      .values({ orgId: ctx.orgId, name: "Osu" })
      .returning();
    const [taxClass] = await tx
      .insert(schema.taxClass)
      .values({ orgId: ctx.orgId, code: "standard", name: "Standard" })
      .returning();
    const [product] = await tx
      .insert(schema.product)
      .values({
        orgId: ctx.orgId,
        sku: "MILO-400",
        name: "Milo 400g",
        taxClassId: taxClass!.id,
        baseUnit: "each",
      })
      .returning();
    return { storeId: store!.id, productId: product!.id };
  },
  audit: (_input, ids) => ids,
});

test("a scheduled price change runs as a Cloudflare Workflow and tells the store at start and end", async () => {
  await using workflows = await introspectWorkflow(bindings.PRICE_CHANGE);
  await workflows.modifyAll(async (modifier) => {
    await modifier.disableSleeps();
  });
  const orgId = v7();
  const context = { orgId, appVersion: buildInfo.version };
  const connection = await cloudflareDatabase(bindings.HYPERDRIVE.connectionString);
  try {
    const { storeId, productId } = await provision(connection.db, context, undefined);
    const realtime = cloudflareRealtime(bindings.STORE_HUB);
    const heard: Envelope[] = [];
    const subscription = await realtime.subscribe(orgId, storeId, v7(), "0", async (message) => {
      heard.push(message);
    });
    const launcher = cloudflareLauncher(bindings.PRICE_CHANGE);
    const now = Date.now();
    const { workflowId } = await schedulePrice(connection.db, context, {
      productId,
      data: {
        amount: 70000,
        startsAt: new Date(now + 60_000).toISOString(),
        endsAt: new Date(now + 3_600_000).toISOString(),
      },
      launch: (id, params) => launcher.start(id, params),
    });
    const [instance] = await workflows.get();
    await instance!.waitForStatus("complete");
    await expect
      .poll(() => heard.map((m) => (m.payload as { phase: string }).phase))
      .toEqual(["start", "end"]);
    await launcher.start(workflowId, { duplicate: true });
    const [run] = await connection.db
      .select()
      .from(schema.workflowRun)
      .where(
        and(eq(schema.workflowRun.orgId, orgId), eq(schema.workflowRun.instanceId, workflowId)),
      );
    expect(run).toMatchObject({
      type: "price-change",
      status: "completed",
      currentStep: "publish-end",
    });
    await subscription.close();
  } finally {
    await connection.close();
  }
});
