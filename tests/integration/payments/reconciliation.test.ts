// Tender reconciliation for a trading day: what each tender took (sales net of change, less refunds), what the Z
// reports expected and declared, and what Paystack paid out for MoMo. Settlements come from Paystack's
// Settlements API through the settlement workflow; a short payout is flagged against its payment.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq, inArray } from "drizzle-orm";
import { boxSettlements } from "@shopper/adapters-box";
import { createApi } from "@shopper/api";
import { createPaystack } from "@shopper/core/payments/paystack";
import * as schema from "@shopper/db-pg";
import { toPesewas, money } from "@shopper/money";
import { ids } from "../../fixtures/sales/golden";
import { copied, figure, reportWorld } from "../../support/reports/world";
import { portalMember } from "../../support/api/portal";
import { expected, postShift, shiftEvent } from "../../support/sales/shifts";
import { startPaystackFake } from "../../../tooling/paystack/server";

let w: Awaited<ReturnType<typeof reportWorld>>;
let fake: Awaited<ReturnType<typeof startPaystackFake>>;
let settlements: ReturnType<typeof boxSettlements>;
let api: ReturnType<typeof createApi>;
let payments: Array<typeof schema.payment.$inferSelect>;
beforeAll(async () => {
  w = await reportWorld();
  fake = await startPaystackFake();
  settlements = boxSettlements({
    database: w.world.db,
    paystack: createPaystack({ secretKey: fake.secretKey, baseUrl: fake.baseUrl }),
  });
  api = createApi({
    database: w.world.db,
    authentication: w.owner.auth,
    settlements: settlements.launcher,
  });
  payments = (
    await w.world.db
      .select({ payment: schema.payment })
      .from(schema.saleTender)
      .innerJoin(schema.payment, eq(schema.payment.id, schema.saleTender.paymentId))
      .where(inArray(schema.saleTender.saleId, [w.sales[3]!.id, w.sales[4]!.id]))
      .orderBy(schema.saleTender.saleId)
  ).map((row) => row.payment);
  const shift = await postShift(
    shiftEvent(w.world, { cash: expected.cash + 5_000 }),
    w.world.session.proof,
  );
  if (shift.status !== 200)
    throw new Error(`The Z report was refused: ${JSON.stringify(shift.body)}`);
}, 300_000);
afterAll(async () => {
  await fake?.stop();
  await w?.world.local.close();
});

const day = "2026-10-15";
const read = async (cookie: string, path: string) => {
  const response = await api.request(path, { headers: { cookie } });
  return { status: response.status, body: (await response.json()) as Record<string, any> };
};
const tender = (body: Record<string, any>, kind: string) =>
  body.tenders.find((row: any) => row.tender === kind);
/** What a planned sale took in one tender: cash net of the change it gave. */
const took = (index: number, kind: "cash" | "momo" | "card") =>
  kind === "cash" ? figure(index, 6) - figure(index, 9) : figure(index, kind === "momo" ? 7 : 8);

test("a day's tenders: taken from sales less refunds, expected and declared from the Z report", async () => {
  const { status, body } = await read(w.owner.cookie, `/reconciliation?day=${day}`);
  expect(status).toBe(200);
  const sold = [2, 3, 4, 5, copied.index];
  const cash = tender(body, "cash");
  expect(cash.taken).toBe(sold.reduce((sum, i) => sum + took(i, "cash"), 0));
  expect(cash).toMatchObject({
    expected: expected.cash,
    declared: expected.cash + 5_000,
    variance: 5_000,
  });
  expect(tender(body, "card")).toMatchObject({
    // The world's refund pays back on card.
    taken: sold.reduce((sum, i) => sum + took(i, "card"), 0) - w.refund.total,
    expected: expected.card,
    declared: expected.card,
    variance: 0,
  });
  expect(tender(body, "momo").taken).toBe(took(3, "momo") + took(4, "momo"));
  expect(body.shifts).toHaveLength(1);
  expect(body.shifts[0]).toMatchObject({ branchId: ids.branch, deviceId: w.world.scope.deviceId });
});

test("a settlement short by one pesewa is flagged on its payment, and recording it twice changes nothing", async () => {
  const [exact, split] = payments;
  fake.payout({
    id: 501,
    date: "2026-10-16",
    lines: [
      { reference: exact!.reference, amount: toPesewas(money(exact!.amount)), fees: 180 },
      { reference: split!.reference, amount: toPesewas(money(split!.amount)) - 1, fees: 60 },
      { reference: "another-merchant-charge", amount: 9_999 },
    ],
  });
  const before = await read(w.owner.cookie, `/reconciliation?day=${day}`);
  expect(before.body.momo).toMatchObject({ unsettled: 2, mismatches: [] });

  const id = `settlement-${ids.org}-2026-10-16`;
  await settlements.launcher.start(id, { orgId: ids.org, day: "2026-10-16" });
  await settlements.idle();
  await settlements.launcher.start(`${id}-again`, { orgId: ids.org, day: "2026-10-16" });
  await settlements.idle();

  const lines = await w.world.db
    .select()
    .from(schema.settlementLine)
    .where(eq(schema.settlementLine.orgId, ids.org));
  expect(Object.fromEntries(lines.map((line) => [line.paymentId, line.flag]))).toEqual({
    [exact!.id]: "ok",
    [split!.id]: "amount_mismatch",
  });
  const [payout] = await w.world.db
    .select()
    .from(schema.settlement)
    .where(and(eq(schema.settlement.orgId, ids.org), eq(schema.settlement.providerId, "501")));
  expect(payout).toMatchObject({ provider: "paystack", settledOn: "2026-10-16", fees: 24_000 });

  const after = await read(w.owner.cookie, `/reconciliation?day=${day}`);
  expect(tender(after.body, "momo").settled).toBe(exact!.amount + split!.amount - 100);
  expect(after.body.momo.unsettled).toBe(0);
  expect(after.body.momo.mismatches).toEqual([
    expect.objectContaining({
      paymentId: split!.id,
      reference: split!.reference,
      expected: split!.amount,
      settled: split!.amount - 100,
      settledOn: "2026-10-16",
    }),
  ]);
});

test("refreshing a day's settlement needs payment.reconcile; a scoped reader sees only their branch", async () => {
  const accountant = await portalMember(w.owner, "accountant");
  const cashier = await portalMember(w.owner, "cashier");
  const refresh = (cookie: string) =>
    api.request("/reconciliation/settlements/refresh", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ day: "2026-10-16" }),
    });
  expect((await refresh(cashier)).status).toBe(403);
  expect((await refresh(accountant)).status).toBe(202);
  await settlements.idle();
  const runs = await w.world.db
    .select()
    .from(schema.workflowRun)
    .where(and(eq(schema.workflowRun.orgId, ids.org), eq(schema.workflowRun.type, "settlement")));
  expect(runs.length).toBeGreaterThanOrEqual(3);

  const userId = (await w.owner.auth.resolvePrincipal(
    new Request("http://localhost", { headers: { cookie: accountant } }),
  ))!.userId;
  const [row] = await w.world.db
    .select({ id: schema.member.id })
    .from(schema.member)
    .where(eq(schema.member.userId, userId));
  await w.world.db
    .insert(schema.memberBranch)
    .values({ orgId: ids.org, memberId: row!.id, branchId: w.otherBranch });
  const scoped = await read(accountant, `/reconciliation?day=${day}`);
  expect(scoped.status).toBe(200);
  expect(tender(scoped.body, "cash").taken).toBe(took(copied.index, "cash"));
  expect(tender(scoped.body, "momo")).toMatchObject({ taken: 0, settled: 0 });
  expect(scoped.body.shifts).toEqual([]);
  expect((await read(accountant, `/reconciliation?day=${day}&branchId=${ids.branch}`)).status).toBe(
    403,
  );
});
