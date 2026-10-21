import { createExecutionContext, createMessageBatch, env, getQueueResult } from "cloudflare:test";
import { expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import { cloudflareDatabase } from "@shopper/adapters-cf";
import { buildInfo } from "@shopper/config";
import type { Envelope } from "@shopper/ports";
import worker from "@shopper/edge";

const bindings = env as unknown as Parameters<typeof worker.queue>[1];
const seed = defineCommand({
  name: "worker.alert.seed",
  async run(tx, ctx) {
    await tx.insert(schema.org).values({ id: ctx.orgId, name: "Worker alerts" });
    const [store] = await tx
      .insert(schema.store)
      .values({ orgId: ctx.orgId, name: "Osu" })
      .returning();
    const [branch] = await tx
      .insert(schema.branch)
      .values({
        orgId: ctx.orgId,
        storeId: store!.id,
        name: "Osu branch",
        alertPhones: ["0241234567"],
      })
      .returning();
    const [taxClass] = await tx
      .insert(schema.taxClass)
      .values({ orgId: ctx.orgId, code: "standard", name: "Standard" })
      .returning();
    const [product] = await tx
      .insert(schema.product)
      .values({
        orgId: ctx.orgId,
        sku: "RICE",
        name: "Rice",
        taxClassId: taxClass!.id,
        baseUnit: "each",
      })
      .returning();
    const [alert] = await tx
      .insert(schema.stockAlert)
      .values({
        orgId: ctx.orgId,
        branchId: branch!.id,
        productId: product!.id,
        levelThousandths: 3_000,
        onHandThousandths: 1_000,
      })
      .returning();
    return alert!.id;
  },
  audit: () => ({}),
});

test("The edge queue handler texts a raised alert", async () => {
  const orgId = v7();
  const connection = await cloudflareDatabase(bindings.HYPERDRIVE.connectionString);
  let alertId: string;
  try {
    alertId = await seed(connection.db, { orgId, appVersion: buildInfo.version }, undefined);
  } finally {
    await connection.close();
  }
  const message: Envelope = {
    id: v7(),
    orgId,
    v: 1,
    sequence: "0",
    type: "stock.low",
    payload: { alertId },
  };
  const batch = createMessageBatch("shopper-notifications-dev", [
    { id: "alert", timestamp: Date.now(), attempts: 1, body: JSON.stringify(message) },
  ]);
  const ctx = createExecutionContext();
  await worker.queue(batch as MessageBatch<string>, bindings);
  const result = await getQueueResult(batch, ctx);
  expect(result.explicitAcks).toEqual(["alert"]);
  expect(result.retryMessages).toEqual([]);

  const sent = (await (await fetch(`${bindings.ARKESEL_BASE_URL}/test/requests`)).json()) as {
    sender: string;
    message: string;
    recipients: string[];
  }[];
  expect(sent).toEqual([
    {
      sender: "Shopper",
      message: "Low stock: Rice at Osu branch, 1 left, reorder at 3.",
      recipients: ["233241234567"],
    },
  ]);
  const connection2 = await cloudflareDatabase(bindings.HYPERDRIVE.connectionString);
  try {
    const [row] = await connection2.db
      .select()
      .from(schema.stockAlert)
      .where(eq(schema.stockAlert.id, alertId));
    expect(row!.sentAt).toBeInstanceOf(Date);
  } finally {
    await connection2.close();
  }
});
