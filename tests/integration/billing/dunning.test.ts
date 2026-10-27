// Shopper's own billing: on the billing day an invoice is raised for the org's stores and registers with a Paystack
// checkout link and emailed to the owner; unpaid, reminders go out at +3 and +7 days and the back office turns
// read-only at +14, while tills keep trading. Paying (the webhook, however often it arrives) restores access once.
import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";
import { and, eq, sql } from "drizzle-orm";
import { createApi } from "@shopper/api";
import { invoiceAmount, billingId, runBilling } from "@shopper/core/billing";
import { createPaystack } from "@shopper/core/payments/paystack";
import { runWatchdog } from "@shopper/core/reports";
import * as schema from "@shopper/db-pg";
import { money, toPesewas } from "@shopper/money";
import { memoryWorkflow, type Json } from "@shopper/ports";
import { ids } from "../../fixtures/sales/golden";
import { tradingDay } from "../../fixtures/sales/golden/day";
import { goldenWorld } from "../../support/sales/golden/setup";
import { runGolden } from "../../support/sales/golden/run";
import { portalOwner, protectOwner, type Portal } from "../../support/api/portal";
import { notifications, sentMessages } from "../../support/stock/queue";
import { devices } from "../../support/till/server";
import { signWebhook, startPaystackFake } from "../../../tooling/paystack/server";

const DAY = 86_400_000;
let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let fake: Awaited<ReturnType<typeof startPaystackFake>>;
let api: ReturnType<typeof createApi>;
const sent: { id: string; type: string; payload: Json }[] = [];
beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  await protectOwner(ids.org, owner);
  fake = await startPaystackFake();
  api = createApi({
    database: world.db,
    devices,
    authentication: owner.auth,
    notifications,
    paystackSecret: fake.secretKey,
    billing: {
      start: async () => {},
      send: async (id, type, payload) => void sent.push({ id, type, payload }),
    },
  });
}, 300_000);
afterAll(async () => {
  await fake?.stop();
  await world?.local.close();
});

const day = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
const deps = () => ({
  withDatabase: <T>(run: (db: typeof world.db) => Promise<T>) => run(world.db),
  appVersion: "test",
  queue: notifications,
  paystack: createPaystack({ secretKey: fake.secretKey, baseUrl: fake.baseUrl }),
  baseUrl: "https://portal.example",
});
async function subscribe(nextInvoiceOn: string) {
  await world.db
    .insert(schema.subscription)
    .values({ orgId: ids.org, billingDay: 1, nextInvoiceOn })
    .onConflictDoUpdate({
      target: schema.subscription.orgId,
      set: { status: "active", nextInvoiceOn },
    });
}
const subscription = async () =>
  (
    await world.db.select().from(schema.subscription).where(eq(schema.subscription.orgId, ids.org))
  )[0]!;
const invoiceFor = async (periodStart: string) =>
  (
    await world.db
      .select()
      .from(schema.invoice)
      .where(and(eq(schema.invoice.orgId, ids.org), eq(schema.invoice.periodStart, periodStart)))
  )[0]!;
const queued = async (type: string) => (await sentMessages()).filter((m) => m.type === type);
const pay = (reference: string, amount: number) => {
  const body = JSON.stringify({
    event: "charge.success",
    data: { reference, status: "success", amount, metadata: { invoiceId: reference } },
  });
  return api.request("/webhooks/paystack", {
    method: "POST",
    headers: { "x-paystack-signature": signWebhook(fake.secretKey, body) },
    body,
  });
};
const manage = async (saleId: string) =>
  (
    await api.request(`/transactions/${saleId}/receipt/email`, {
      method: "POST",
      headers: { cookie: owner.cookie, "content-type": "application/json" },
      body: JSON.stringify({
        requestKey: "019a0000-0000-7000-8000-00000000d001",
        email: "owner@example.com",
      }),
    })
  ).status;

test("prices: GHS 550 a store with its first register, 300 each for the 2nd and 3rd, 250 from the 4th", () => {
  const ghs = (amount: number) => money(amount * 10_000);
  expect(invoiceAmount([1])).toBe(ghs(550));
  expect(invoiceAmount([3])).toBe(ghs(1_150));
  expect(invoiceAmount([5])).toBe(ghs(1_650));
  expect(invoiceAmount([1, 2])).toBe(ghs(1_400));
  expect(invoiceAmount([0])).toBe(ghs(550));
});

test("an unpaid invoice is reminded at +3 and +7 days and turns the back office read-only at +14", async () => {
  const periodStart = day(-15);
  await subscribe(periodStart);
  await runBilling(memoryWorkflow(billingId(ids.org, periodStart)), deps(), {
    orgId: ids.org,
    periodStart,
  });
  const issued = await invoiceFor(periodStart);
  const registers = await world.db.execute(
    sql`SELECT count(*)::int AS n FROM device_credential WHERE org_id = ${ids.org} AND revoked_at IS NULL`,
  );
  expect(issued).toMatchObject({
    status: "open",
    stores: 1,
    terminals: (registers.rows[0] as { n: number }).n,
    reminders: 2,
    checkoutUrl: expect.stringContaining(issued.reference),
  });
  expect(issued.amount).toBe(invoiceAmount([issued.terminals]));
  expect(fake.requests.filter((r) => r.path === "/transaction/initialize")).toHaveLength(1);
  // The next invoice falls a month on, where this one's period ends.
  expect(await subscription()).toMatchObject({
    status: "read_only",
    nextInvoiceOn: issued.periodEnd,
  });
  const length = (Date.parse(issued.periodEnd) - Date.parse(periodStart)) / DAY;
  expect(length).toBeGreaterThanOrEqual(28);
  expect(length).toBeLessThanOrEqual(31);
  for (const type of ["invoice.issued", "invoice.reminder", "invoice.read_only"])
    expect((await queued(type)).length).toBeGreaterThan(0);
  expect(await queued("invoice.reminder")).toHaveLength(2);

  // A rerun of the same period raises nothing twice.
  await runBilling(memoryWorkflow(billingId(ids.org, periodStart)), deps(), {
    orgId: ids.org,
    periodStart,
  });
  expect(await queued("invoice.issued")).toHaveLength(1);

  // Read-only: back-office changes are refused; reads, billing and the tills carry on.
  const sale = (await runGolden(
    world,
    tradingDay.find((s) => s.name === "manual card")!,
  ))!;
  expect(sale).toBeTruthy();
  expect(await manage(sale.id)).toBe(402);
  expect(
    (
      await api.request(`/transactions?from=${day(-1)}&to=${day(1)}`, {
        headers: { cookie: owner.cookie },
      })
    ).status,
  ).toBe(200);
  // Every member's shell reads the state for its banner, without the billing permission.
  const status = await api.request("/billing/status", { headers: { cookie: owner.cookie } });
  expect(await status.json()).toEqual({ readOnly: true });
  expect((await api.request("/billing/status")).status).toBe(401);
  const billing = await api.request("/billing", { headers: { cookie: owner.cookie } });
  expect(billing.status).toBe(200);
  expect(await billing.json()).toMatchObject({
    subscription: { status: "read_only" },
    invoices: [{ id: issued.id, status: "open", checkoutUrl: issued.checkoutUrl }],
  });

  // The checkout's webhook, replayed three times, pays once and restores access.
  const pesewas = toPesewas(issued.amount);
  expect((await pay(issued.reference, pesewas - 100)).status).toBe(400);
  for (let attempt = 0; attempt < 3; attempt++)
    expect((await pay(issued.reference, pesewas)).status).toBe(200);
  expect(await invoiceFor(periodStart)).toMatchObject({ status: "paid" });
  expect((await subscription()).status).toBe("active");
  const paid = await world.db.execute(
    sql`SELECT 1 FROM audit_log WHERE command = 'billing.invoice.paid' AND entity_id = ${issued.id}`,
  );
  expect(paid.rows).toHaveLength(1);
  expect(sent.filter((s) => s.id === billingId(ids.org, periodStart))).toHaveLength(1);
  expect(await manage(sale.id)).toBe(202);
  expect(
    await (await api.request("/billing/status", { headers: { cookie: owner.cookie } })).json(),
  ).toEqual({ readOnly: false });
});

test("an invoice paid before its first reminder ends the period's dunning", async () => {
  const periodStart = day(0);
  await subscribe(periodStart);
  const flow = memoryWorkflow(billingId(ids.org, periodStart));
  const running = runBilling(flow, deps(), { orgId: ids.org, periodStart });
  await vi.waitFor(async () => expect(await invoiceFor(periodStart)).toBeDefined());
  const issued = await invoiceFor(periodStart);
  expect((await pay(issued.reference, toPesewas(issued.amount))).status).toBe(200);
  // The webhook wakes the period's workflow through the launcher; this engine is the test's own.
  await flow.send(billingId(ids.org, periodStart), "invoice.paid", {});
  await running;
  expect(await invoiceFor(periodStart)).toMatchObject({ status: "paid", reminders: 0 });
  expect(await queued("invoice.reminder")).toHaveLength(2);
  // The run is complete in PostgreSQL, not left waiting where the engine stopped.
  const [run] = await world.db
    .select()
    .from(schema.workflowRun)
    .where(eq(schema.workflowRun.instanceId, billingId(ids.org, periodStart)));
  expect(run).toMatchObject({ status: "completed", currentStep: "settled" });
});

test("paying one period keeps the back office read-only while an older one is still overdue", async () => {
  const [older, newer] = [day(-45), day(-20)];
  for (const periodStart of [older, newer]) {
    await subscribe(periodStart);
    await runBilling(memoryWorkflow(billingId(ids.org, periodStart)), deps(), {
      orgId: ids.org,
      periodStart,
    });
  }
  expect((await subscription()).status).toBe("read_only");
  const later = await invoiceFor(newer);
  expect((await pay(later.reference, toPesewas(later.amount))).status).toBe(200);
  expect((await subscription()).status).toBe("read_only");
  const first = await invoiceFor(older);
  expect((await pay(first.reference, toPesewas(first.amount))).status).toBe(200);
  expect((await subscription()).status).toBe("active");
});

test("the watchdog starts the billing period falling due by tomorrow", async () => {
  const started: string[] = [];
  const launcher = { start: async (id: string) => void started.push(id), send: async () => {} };
  await subscribe(day(1));
  await runWatchdog(
    {
      withDatabase: (run) => run(world.db),
      anchors: { start: async () => {}, send: async () => {} },
      storeDays: { start: async () => {}, send: async () => {} },
      billing: launcher,
    },
    new Date(),
  );
  expect(started).toContain(billingId(ids.org, day(1)));
});
