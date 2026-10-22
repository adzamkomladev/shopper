// Account payments at the drawer: {type:"account.payment", customerId, method:"cash"|"momo", amount, reference?} ->
//   {type:"result", kind:"accountPayment", payment:{id, customerId, method, amount, shiftId}, printed}
// The payment is a document in the register's `account_payment` table (needs an open shift and sale.create). Cash is
// taken offline too, because it can only lower what is owed; MoMo needs the network and a MoMo reference. The upload
// lane runs after the sales and after the customer's own upload; the server records it as `customer.payment`.
// X and Z gain account:{sales, payments:{cash,momo}, refunds, points, pointsValue}; cash payments join expected cash.
import { afterAll, afterEach, beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { portalOwner } from "../../../support/api/portal";
import { registerSettings, startPrinter, type Printer } from "../../../support/hardware/host";
import { customerApi } from "../../../support/customers/http";
import { startCounter } from "../../../support/customers/till";
import { UNIT, arrived, creditSale } from "../../../support/customers/account";
import { verifiedCustomer } from "../../../support/customers/credit";
import { entries } from "../../../support/customers/ledger";
import { addCreditEntry, folds } from "../../../support/customers/seed";
import { paymentAudit, report, shiftOf, tillPayments } from "../../../support/customers/payment";
import { ids } from "../../../support/till/sales";
import { principal } from "../../../support/till/server";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let portal: ReturnType<typeof customerApi>;
let counter: Awaited<ReturnType<typeof startCounter>> | undefined;
let printer: Printer | undefined;
beforeAll(async () => {
  world = await goldenWorld();
  const owner = await portalOwner(ids.org, ids.cashier);
  portal = customerApi(owner, owner.cookie);
});
afterAll(async () => world?.local.close());
afterEach(async () => {
  await counter?.close();
  await printer?.stop();
  counter = printer = undefined;
});

/** A customer who owes `owed`, and a register that has pulled them. */
async function owing(
  phone: string,
  owed: number,
  options: Parameters<typeof startCounter>[0] = {},
) {
  const customerId = await verifiedCustomer(portal, 1_000_000, { phone });
  if (owed) await addCreditEntry(customerId, "charge", owed);
  counter = await startCounter(options);
  await counter.settle();
  return customerId;
}
const pay = (customerId: string, over: Record<string, unknown> = {}) =>
  counter!.ask({ type: "account.payment", customerId, method: "cash", amount: 200_000, ...over });

test("an offline cash payment is kept at once, uploads after the pending sale, lowers the balance and is audited", async () => {
  const customerId = await owing("0271760001", 500_000);
  await counter!.offline();
  const reply = await pay(customerId);
  expect(reply).toMatchObject({
    type: "result",
    kind: "accountPayment",
    payment: { customerId, method: "cash", amount: 200_000 },
    printed: false,
  });
  const shiftId = await shiftOf(counter!);
  expect(reply.payment.shiftId).toBe(shiftId);
  expect(await tillPayments(counter!)).toMatchObject([
    { id: reply.payment.id, customer_id: customerId, shift_id: shiftId, accepted_at: null },
  ]);
  expect((await folds(customerId)).balance).toBe(500_000);

  await counter!.online();
  expect(counter!.wire()).toEqual(["sale", "account.payment"]);
  expect((await folds(customerId)).balance).toBe(300_000);
  expect(await entries(customerId)).toMatchObject([
    { kind: "charge", amount: 500_000 },
    { kind: "payment", amount: -200_000, method: "cash", actor_id: principal.userId },
  ]);
  expect((await tillPayments(counter!))[0]!.accepted_at).not.toBeNull();
  const [audit, ...rest] = await paymentAudit(customerId);
  expect(rest).toEqual([]);
  expect(audit).toMatchObject({ actorId: principal.userId });
  expect(audit!.payload).toMatchObject({ method: "cash", amount: 200_000, shiftId });
  expect(await counter!.register.audit("till.account.payment")).toHaveLength(1);
});

test("MoMo needs the network and a reference; cash does not need the customer to have reached the server", async () => {
  const customerId = await owing("0271760002", 100_000);
  counter!.upstream.setAvailable(false);
  expect(await pay(customerId, { method: "momo", reference: "MM-1" })).toMatchObject({
    type: "error",
    code: "OFFLINE_UNAVAILABLE",
  });
  counter!.upstream.setAvailable(true);
  expect(await pay(customerId, { method: "momo" })).toMatchObject({
    type: "error",
    code: "INVALID_INPUT",
  });
  expect(await tillPayments(counter!)).toEqual([]);

  // A customer made on this till is paid in cash before the server has even heard of them.
  await counter!.offline();
  const made = await counter!.create({ name: "Kofi New", phone: "0271760003" });
  const fresh = made.customer.id as string;
  expect(await pay(fresh, { amount: 50_000 })).toMatchObject({ kind: "accountPayment" });
  await counter!.online();
  expect(counter!.wire()).toEqual(["sale", "customer.created", "account.payment"]);
  expect((await folds(fresh)).balance).toBe(-50_000);
});

test("refused without an open shift, without sale.create, for an unknown customer or a bad amount, writing nothing", async () => {
  counter = await startCounter({ shift: false });
  expect(await pay(v7())).toMatchObject({ type: "error", code: "SHIFT_REQUIRED" });
  await counter.close();

  const customerId = await owing("0271760004", 0, { without: ["sale.create"] });
  expect(await pay(customerId)).toMatchObject({ type: "error", code: "permission" });
  await counter!.close();

  const other = await owing("0271760005", 0);
  expect(await pay(v7())).toMatchObject({ type: "error", code: "CUSTOMER_UNKNOWN" });
  for (const amount of [0, -5, 1.5])
    expect(await pay(other, { amount })).toMatchObject({ type: "error", code: "INVALID_INPUT" });
  expect(await tillPayments(counter!)).toEqual([]);
  expect(await counter!.register.audit("till.account.payment")).toHaveLength(0);
});

test("expected cash includes cash payments only, and the X and its printout show the account lines", async () => {
  const customerId = await owing("0271760006", 500_000, {
    permissions: ["register.settings", "report.read"],
  });
  printer = await startPrinter();
  await counter!.register.configure(registerSettings(printer.port));
  const before = await report(counter!);
  expect(before.account).toEqual({
    sales: 0,
    payments: { cash: 0, momo: 0 },
    refunds: 0,
    points: 0,
    pointsValue: 0,
  });

  expect(await pay(customerId, { amount: 30_000 })).toMatchObject({ printed: true });
  const momo = { method: "momo", amount: 20_000, reference: "MM-REF-9" };
  expect(await pay(customerId, momo)).toMatchObject({ printed: true });
  const after = await report(counter!);
  expect(after.account).toMatchObject({ payments: { cash: 30_000, momo: 20_000 } });
  expect(after.cash.expected).toBe(before.cash.expected + 30_000);
  // The cash tender holds the drawer, so only its expected moves; MoMo paid onto an account is not a MoMo sale.
  const [cashTender, ...others] = before.tenders;
  expect(after.tenders).toEqual([
    { ...cashTender, expected: cashTender.expected + 30_000 },
    ...others,
  ]);

  expect(await counter!.ask({ type: "shift.print" })).toMatchObject({ kind: "status" });
  const [cash, mobile, x] = await printer.waitForJobs(3);
  expect(cash!.page).toContain("ACCOUNT PAYMENT");
  expect(cash!.page).toContain("Credit Customer");
  expect(cash!.page).toContain("GHS 3.00");
  expect(mobile!.page).toContain("MM-REF-9");
  const lines = ["X REPORT", "On-account sales", "Account payments", "Refunds to accounts"];
  for (const line of [...lines, "Points redeemed"]) expect(x!.page).toContain(line);
});

test("an on-account sale and the refund credited back to the account show on the X without touching the tenders", async () => {
  const customerId = await verifiedCustomer(portal, 2_000_000, { phone: "0271760007" });
  counter = await startCounter({ permissions: ["register.settings", "report.read"] });
  await counter.settle();
  const before = await report(counter);
  const sold = await creditSale(counter, customerId, { units: 1, credit: UNIT });
  expect((await report(counter)).account).toMatchObject({ sales: UNIT, refunds: 0 });

  const returned = await counter.ask({
    type: "refund.record",
    receipt: sold.receipt,
    lines: [{ lineId: sold.sale.lines[0].id, quantityThousandths: 1000 }],
    reason: "Customer returned goods",
    tender: { kind: "cash" },
  });
  expect(returned).toMatchObject({ kind: "refund" });
  const after = await report(counter);
  expect(after.account).toMatchObject({ sales: UNIT, refunds: UNIT });
  expect(after.refunds).toMatchObject({ count: 1, total: 0 });
  expect(after.cash.expected).toBe(before.cash.expected);
  await arrived(counter, sold.saleId);
});
