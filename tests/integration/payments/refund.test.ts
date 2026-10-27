import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";
import { and, eq, inArray } from "drizzle-orm";
import { boxMomoRefund } from "@shopper/adapters-box";
import { createApi } from "@shopper/api";
import { createPaystack } from "@shopper/core/payments/paystack";
import * as schema from "@shopper/db-pg";
import type { GoldenSale } from "../../fixtures/sales/golden/types";
import { goldenWorld } from "../../support/sales/golden/setup";
import { runGolden } from "../../support/sales/golden/run";
import { postRefund, refundEvent } from "../../support/sales/refunds";
import { sentMessages } from "../../support/stock/queue";
import { startPaystackFake } from "../../../tooling/paystack/server";

const scenario: GoldenSale = {
  name: "MoMo refund",
  lines: [{ product: "standard", quantity: 2_000 }],
  tenders: [{ kind: "momo", amount: 240_000 }],
};
let world: Awaited<ReturnType<typeof goldenWorld>>;
let fake: Awaited<ReturnType<typeof startPaystackFake>>;
beforeAll(async () => {
  world = await goldenWorld();
  fake = await startPaystackFake();
});
afterAll(async () => {
  await fake?.stop();
  await world?.local.close();
});

const launcher = (timeoutMs = 60_000) =>
  boxMomoRefund({
    withDatabase: (run) => run(world.db),
    paystack: createPaystack({ secretKey: fake.secretKey, baseUrl: fake.baseUrl }),
    appVersion: "test",
    timeoutMs,
  });

/** A MoMo sale whose payment the fake Paystack knows as settled, refunded by one unit in MoMo. */
async function refundOne() {
  const sale = (await runGolden(world, scenario))!;
  const [paid] = await world.db
    .select({ payment: schema.payment })
    .from(schema.saleTender)
    .innerJoin(schema.payment, eq(schema.payment.id, schema.saleTender.paymentId))
    .where(eq(schema.saleTender.saleId, sale.id));
  fake.knownCharge(paid!.payment.reference, 2_400);
  const event = refundEvent(world, sale, [{ line: 0, before: 0, after: 1_000 }], {
    tender: { kind: "momo", reference: "MOMO-REFUND-1" },
  });
  expect((await postRefund(event, world.session.proof)).body.accepted).toBeDefined();
  const rows = await world.db
    .select()
    .from(schema.paymentRefund)
    .where(eq(schema.paymentRefund.refundId, event.refund.id));
  return { payment: paid!.payment, rows, refundId: event.refund.id };
}

const refundCalls = (reference: string) =>
  fake.requests.filter(
    (r) => r.path === "/refund" && (r.body as { transaction: string }).transaction === reference,
  );

test("a MoMo refund sends the money back through Paystack once, and a replayed webhook applies once", async () => {
  const { payment, rows } = await refundOne();
  expect(rows).toMatchObject([{ paymentId: payment.id, amount: 120_000, status: "pending" }]);
  const id = rows[0]!.id;
  expect((await sentMessages()).filter((m) => m.type === "payment.refund")).toContainEqual(
    expect.objectContaining({ payload: { id } }),
  );
  const refunds = launcher();
  await refunds.start(id, { orgId: world.config.orgId, id });
  await refunds.start(id, { orgId: world.config.orgId, id });
  await vi.waitFor(() => expect(refundCalls(payment.reference)).toHaveLength(1));
  expect(refundCalls(payment.reference)[0]!.body).toMatchObject({ amount: 1_200 });
  const sent = await vi.waitFor(async () => {
    const [row] = await world.db
      .select()
      .from(schema.paymentRefund)
      .where(eq(schema.paymentRefund.id, id));
    expect(row!.providerReference).toBeTruthy();
    return row!;
  });
  fake.finishRefund(sent.providerReference!, "processed");
  const api = createApi({
    database: world.db,
    paystackSecret: fake.secretKey,
    momoPayment: refunds,
    momoRefund: refunds,
  });
  const webhook = fake.refundWebhook(sent.providerReference!, "refund.processed");
  for (let attempt = 0; attempt < 3; attempt++) {
    const reply = await api.request("/webhooks/paystack", {
      method: "POST",
      headers: { "x-paystack-signature": webhook.signature },
      body: webhook.body,
    });
    expect(reply.status).toBe(200);
  }
  await vi.waitFor(async () => {
    const [run] = await world.db
      .select()
      .from(schema.workflowRun)
      .where(eq(schema.workflowRun.instanceId, id));
    expect(run).toMatchObject({ type: "momo-refund", status: "completed" });
  });
  const [done] = await world.db
    .select()
    .from(schema.paymentRefund)
    .where(eq(schema.paymentRefund.id, id));
  expect(done!.status).toBe("processed");
  expect(
    await world.db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.command, "payment.refund.webhook"),
          eq(schema.auditLog.orgId, world.config.orgId),
        ),
      ),
  ).toHaveLength(1);
  expect(refundCalls(payment.reference)).toHaveLength(1);
});

test("a refund Paystack never confirms is verified once and stays reserved, and a late webhook settles it", async () => {
  const { payment, rows } = await refundOne();
  const id = rows[0]!.id;
  await launcher(300).start(id, { orgId: world.config.orgId, id });
  const unconfirmed = await vi.waitFor(
    async () => {
      const [row] = await world.db
        .select()
        .from(schema.paymentRefund)
        .where(eq(schema.paymentRefund.id, id));
      expect(row!.failureReason).toContain("Paystack has not confirmed");
      return row!;
    },
    { timeout: 5000 },
  );
  expect(unconfirmed.status).toBe("pending");
  expect(
    fake.requests.filter((r) => r.path === `/refund/${unconfirmed.providerReference}`),
  ).toHaveLength(1);
  expect(refundCalls(payment.reference)).toHaveLength(1);
  fake.finishRefund(unconfirmed.providerReference!, "processed");
  const webhook = fake.refundWebhook(unconfirmed.providerReference!, "refund.processed");
  const api = createApi({
    database: world.db,
    paystackSecret: fake.secretKey,
    momoPayment: launcher(),
  });
  const reply = await api.request("/webhooks/paystack", {
    method: "POST",
    headers: { "x-paystack-signature": webhook.signature },
    body: webhook.body,
  });
  expect(reply.status).toBe(200);
  const [settled] = await world.db
    .select()
    .from(schema.paymentRefund)
    .where(eq(schema.paymentRefund.id, id));
  expect(settled).toMatchObject({ status: "processed", failureReason: null });
});

test("a Hubtel payment's refund is left for the Hubtel dashboard and starts no workflow", async () => {
  const sale = (await runGolden(world, scenario))!;
  const [tender] = await world.db
    .select()
    .from(schema.saleTender)
    .where(eq(schema.saleTender.saleId, sale.id));
  await world.db
    .update(schema.payment)
    .set({ provider: "hubtel" })
    .where(eq(schema.payment.id, tender!.paymentId!));
  const event = refundEvent(world, sale, [{ line: 0, before: 0, after: 1_000 }], {
    tender: { kind: "momo", reference: "MOMO-REFUND-2" },
  });
  expect((await postRefund(event, world.session.proof)).body.accepted).toBeDefined();
  const rows = await world.db
    .select()
    .from(schema.paymentRefund)
    .where(eq(schema.paymentRefund.refundId, event.refund.id));
  expect(rows).toMatchObject([{ status: "manual", amount: 120_000 }]);
  expect(
    (await sentMessages()).filter(
      (m) => m.type === "payment.refund" && (m.payload as { id: string }).id === rows[0]!.id,
    ),
  ).toEqual([]);
});

test("a webhook names its refund by Paystack's id when two open refunds of one payment share an amount", async () => {
  const sale = (await runGolden(world, scenario))!;
  const [paid] = await world.db
    .select({ payment: schema.payment })
    .from(schema.saleTender)
    .innerJoin(schema.payment, eq(schema.payment.id, schema.saleTender.paymentId))
    .where(eq(schema.saleTender.saleId, sale.id));
  fake.knownCharge(paid!.payment.reference, 2_400);
  const ids: string[] = [];
  for (const [before, after] of [
    [0, 1_000],
    [1_000, 2_000],
  ] as const) {
    const event = refundEvent(world, sale, [{ line: 0, before, after }], {
      tender: { kind: "momo", reference: `MOMO-SPLIT-${after}` },
    });
    expect((await postRefund(event, world.session.proof)).body.accepted).toBeDefined();
    const [row] = await world.db
      .select()
      .from(schema.paymentRefund)
      .where(eq(schema.paymentRefund.refundId, event.refund.id));
    expect(row).toMatchObject({ paymentId: paid!.payment.id, amount: 120_000 });
    ids.push(row!.id);
    await launcher().start(row!.id, { orgId: world.config.orgId, id: row!.id });
  }
  const sent = await vi.waitFor(async () => {
    const rows = await world.db
      .select()
      .from(schema.paymentRefund)
      .where(inArray(schema.paymentRefund.id, ids));
    expect(rows.every((row) => row.providerReference)).toBe(true);
    return rows;
  });
  const later = sent.find((row) => row.id === ids[1])!;
  fake.finishRefund(later.providerReference!, "failed");
  const webhook = fake.refundWebhook(later.providerReference!, "refund.failed");
  const api = createApi({
    database: world.db,
    paystackSecret: fake.secretKey,
    momoPayment: launcher(),
  });
  await api.request("/webhooks/paystack", {
    method: "POST",
    headers: { "x-paystack-signature": webhook.signature },
    body: webhook.body,
  });
  const rows = await world.db
    .select()
    .from(schema.paymentRefund)
    .where(inArray(schema.paymentRefund.id, ids));
  expect(rows.find((row) => row.id === ids[0])!.status).toBe("pending");
  expect(rows.find((row) => row.id === ids[1])!.status).toBe("failed");
});
