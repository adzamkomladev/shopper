import { env, introspectWorkflow } from "cloudflare:test";
import { test } from "vitest";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import { buildInfo } from "@shopper/config";
import { cloudflareDatabase, cloudflareLauncher } from "@shopper/adapters-cf";
import { startMomo } from "@shopper/core/payments";
import { momoConformance } from "@shopper/conformance";

const bindings = env as {
  HYPERDRIVE: Hyperdrive;
  MOMO_PAYMENT: Workflow;
  PAYSTACK_BASE_URL: string;
  PAYSTACK_SECRET_KEY: string;
};
const provision = defineCommand({
  name: "test.momo.provision",
  async run(tx, ctx) {
    const ids = { store: v7(), branch: v7(), device: v7(), user: v7() };
    await tx.insert(schema.org).values({ id: ctx.orgId, name: "Worker MoMo" });
    await tx.insert(schema.store).values({ id: ids.store, orgId: ctx.orgId, name: "Store" });
    await tx.insert(schema.branch).values({
      id: ids.branch,
      orgId: ctx.orgId,
      storeId: ids.store,
      name: "Branch",
      code: "BR1",
    });
    await tx
      .insert(schema.device)
      .values({ id: ids.device, orgId: ctx.orgId, branchId: ids.branch, name: "Till", code: "T1" });
    await tx
      .insert(schema.user)
      .values({ id: ids.user, orgId: ctx.orgId, email: "cashier@example.com", name: "Cashier" });
    return ids;
  },
  audit: (_input, ids) => ids,
});

momoConformance("Cloudflare workflow", test, async () => {
  const introspection = await introspectWorkflow(bindings.MOMO_PAYMENT);
  const connection = await cloudflareDatabase(bindings.HYPERDRIVE.connectionString);
  const orgId = v7();
  const ctx = { orgId, appVersion: buildInfo.version };
  const ids = await provision(connection.db, ctx, undefined);
  const launcher = cloudflareLauncher(bindings.MOMO_PAYMENT);
  return {
    async start(phone) {
      if (phone === "0241234567")
        await introspection.modifyAll((modifier) =>
          modifier.forceEventTimeout({ name: "event-0" }),
        );
      const payment = await startMomo(
        connection.db,
        { ...ctx, actorId: ids.user, deviceId: ids.device, branchId: ids.branch },
        { phone, amount: 10_000, network: "mtn" },
      );
      await launcher.start(payment.reference, {
        orgId,
        reference: payment.reference,
        phone,
        email: "cashier@example.com",
      });
      return payment.reference;
    },
    otp: (reference, otp) => launcher.send(reference, "payment", { type: "otp", otp }),
    async retry(reference, phone) {
      try {
        const payment = await startMomo(
          connection.db,
          { ...ctx, actorId: ids.user, deviceId: ids.device, branchId: ids.branch },
          { reference, phone, amount: 10_000, network: "mtn" },
        );
        await launcher.start(reference, { orgId, reference, phone, email: "cashier@example.com" });
        return payment.reference === reference;
      } catch (error) {
        if (error instanceof Error && "status" in error && error.status === 409) return false;
        throw error;
      }
    },
    async chargeCount(reference) {
      const response = await fetch(`${bindings.PAYSTACK_BASE_URL}/test/charges/${reference}`, {
        headers: { authorization: `Bearer ${bindings.PAYSTACK_SECRET_KEY}` },
      });
      if (!response.ok) throw new Error("Provider counter unavailable");
      return (await response.json<{ attempts: number }>()).attempts;
    },
    async status(reference) {
      const [row] = await connection.db
        .select()
        .from(schema.payment)
        .where(eq(schema.payment.reference, reference));
      return row!.status;
    },
    async run(reference) {
      const [row] = await connection.db
        .select()
        .from(schema.workflowRun)
        .where(eq(schema.workflowRun.instanceId, reference));
      return { businessKey: row!.businessKey, status: row!.status };
    },
    async close() {
      await introspection[Symbol.asyncDispose]();
      await connection.close();
    },
  };
});
