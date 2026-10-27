import { env, introspectWorkflowInstance } from "cloudflare:test";
import { expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import { cloudflareDatabase, cloudflareLauncher } from "@shopper/adapters-cf";
import { billingId } from "@shopper/core/billing";
import { buildInfo } from "@shopper/config";

const bindings = env as { HYPERDRIVE: Hyperdrive; BILLING: Workflow };
const provision = defineCommand({
  name: "conformance.billing",
  async run(tx, ctx, input: { periodStart: string }) {
    await tx.insert(schema.org).values({ id: ctx.orgId, name: "Worker billing" });
    await tx.insert(schema.store).values({ orgId: ctx.orgId, name: "Osu" });
    await tx
      .insert(schema.subscription)
      .values({ orgId: ctx.orgId, billingDay: 1, nextInvoiceOn: input.periodStart });
    return { orgId: ctx.orgId };
  },
  audit: (_input, output) => output,
});

test("BillingWorkflow raises a period's invoice in workerd and duns it to read-only", async () => {
  const orgId = v7();
  const connection = await cloudflareDatabase(bindings.HYPERDRIVE.connectionString);
  try {
    // A period that started 15 days ago: every dunning deadline has passed, so each wait times out at once.
    const periodStart = new Date(Date.now() - 15 * 86_400_000).toISOString().slice(0, 10);
    await provision(connection.db, { orgId, appVersion: buildInfo.version }, { periodStart });
    const id = billingId(orgId, periodStart);
    await using instance = await introspectWorkflowInstance(bindings.BILLING, id);
    await cloudflareLauncher(bindings.BILLING).start(id, { orgId, periodStart });
    await instance.waitForStatus("complete");

    const [invoice] = await connection.db
      .select()
      .from(schema.invoice)
      .where(eq(schema.invoice.orgId, orgId));
    expect(invoice).toMatchObject({ status: "open", stores: 1, reminders: 2 });
    const [subscription] = await connection.db
      .select()
      .from(schema.subscription)
      .where(eq(schema.subscription.orgId, orgId));
    expect(subscription).toMatchObject({ status: "read_only", nextInvoiceOn: invoice!.periodEnd });
    const [run] = await connection.db
      .select()
      .from(schema.workflowRun)
      .where(eq(schema.workflowRun.instanceId, id));
    expect(run).toMatchObject({
      type: "billing",
      status: "completed",
      currentStep: "read_only-14",
    });
  } finally {
    await connection.close();
  }
});
