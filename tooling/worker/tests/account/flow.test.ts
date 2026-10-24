import { env, introspectWorkflowInstance } from "cloudflare:test";
import { expect, test } from "vitest";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import { buildInfo } from "@shopper/config";
import { money } from "@shopper/money";
import { cloudflareDatabase, cloudflareLoopLauncher } from "@shopper/adapters-cf";

const bindings = env as { HYPERDRIVE: Hyperdrive; ACCOUNT_FLOWS: Workflow };
const day = 86_400_000;
const seed = defineCommand({
  name: "worker.account.seed",
  async run(tx, ctx, input: { customerId: string }) {
    await tx.insert(schema.org).values({
      id: ctx.orgId,
      name: "Worker accounts",
      loyaltyEnabled: true,
      loyaltyEarnBps: 100,
      loyaltyPointValue: money(100),
      loyaltyExpiryDays: 30,
      tierNoticeDays: 0,
    });
    await tx
      .insert(schema.customer)
      .values({ id: input.customerId, orgId: ctx.orgId, name: "Ama Points", phone: "0241112223" });
    await tx.insert(schema.loyaltyEntry).values({
      orgId: ctx.orgId,
      customerId: input.customerId,
      reason: "earn",
      points: 50,
      rateBps: 100,
      pointValue: money(100),
      occurredAt: new Date(Date.now() - 40 * day),
    });
    return {};
  },
  audit: () => ({}),
});

test("AccountWorkflow lapses a lot that is past due, then ends with nothing left to do", async () => {
  const orgId = v7();
  const customerId = v7();
  const connection = await cloudflareDatabase(bindings.HYPERDRIVE.connectionString);
  const instance = await introspectWorkflowInstance(bindings.ACCOUNT_FLOWS, customerId);
  try {
    await seed(connection.db, { orgId, appVersion: buildInfo.version }, { customerId });
    const launcher = cloudflareLoopLauncher(bindings.ACCOUNT_FLOWS, "wake");
    await launcher.start(customerId, { orgId, customerId });
    await instance.waitForStatus("complete");
    const entries = await connection.db
      .select()
      .from(schema.loyaltyEntry)
      .where(
        and(eq(schema.loyaltyEntry.orgId, orgId), eq(schema.loyaltyEntry.customerId, customerId)),
      );
    expect(entries.map((entry) => [entry.reason, entry.points]).sort()).toEqual([
      ["earn", 50],
      ["expire", -50],
    ]);
    const [run] = await connection.db
      .select()
      .from(schema.workflowRun)
      .where(eq(schema.workflowRun.instanceId, customerId));
    expect(run).toMatchObject({ type: "customer-account", status: "completed" });
  } finally {
    await instance.dispose();
    await connection.close();
  }
}, 60_000);
