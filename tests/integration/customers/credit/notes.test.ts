// Credit notes: a back-office note lowers what is owed and needs a reason; a till refund of a sale paid on account
// goes back to the account first, as a credit note tied to the refund, up to what the sale charged to it, and only
// the rest is paid out. (Points come back between the two once loyalty exists, in a later slice.)
import { afterAll, afterEach, beforeAll, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { ids } from "../../../support/till/sales";
import { databases } from "../../../support/till/server";
import { portalMember, portalOwner, type Portal } from "../../../support/api/portal";
import { customerApi } from "../../../support/customers/http";
import { addCreditEntry, addCustomer, folds } from "../../../support/customers/seed";
import { startCounter } from "../../../support/customers/till";
import { arrived, creditSale } from "../../../support/customers/account";
import { verifiedCustomer } from "../../../support/customers/credit";
import { auditCommands, chainValid, creditApi, entries } from "../../../support/customers/ledger";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let admin: ReturnType<typeof creditApi>;
let cashier: ReturnType<typeof creditApi>;
let accountant: ReturnType<typeof creditApi>;
let portal: ReturnType<typeof customerApi>;
let counter: Awaited<ReturnType<typeof startCounter>> | undefined;

beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  admin = creditApi(owner, owner.cookie);
  portal = customerApi(owner, owner.cookie);
  cashier = creditApi(owner, await portalMember(owner, "cashier"));
  accountant = creditApi(owner, await portalMember(owner, "accountant"));
});
afterAll(async () => world?.local.close());
afterEach(async () => {
  await counter?.close();
  counter = undefined;
});

test("a credit note lowers the balance, keeps its reason and who wrote it, and is audited", async () => {
  const customerId = await addCustomer({ creditLimit: 1_000_000, phone: "0271730001" });
  await addCreditEntry(customerId, "charge", 200_000);
  const noted = await admin.note(customerId, { amount: 60_000, reason: "Damaged goods" });
  expect(noted.status).toBe(201);
  expect(noted.body).toMatchObject({ id: customerId, balance: 140_000 });
  expect(await entries(customerId)).toMatchObject([
    { kind: "charge", amount: 200_000 },
    {
      kind: "credit_note",
      amount: -60_000,
      reason: "Damaged goods",
      actor_id: owner.principal.userId,
    },
  ]);
  expect(await folds(customerId)).toMatchObject({ balance: 140_000 });
  expect(await chainValid()).toBe(true);
  expect((await auditCommands(customerId)).filter((c) => /credit.?note/.test(c))).toHaveLength(1);
});

test("a credit note needs a reason and a positive whole amount, and writes nothing otherwise", async () => {
  const customerId = await addCustomer({ phone: "0271730002" });
  await addCreditEntry(customerId, "charge", 100_000);
  for (const bad of [
    { amount: 10_000 },
    { amount: 10_000, reason: "" },
    { amount: 10_000, reason: "   " },
    { amount: 0, reason: "Nothing" },
    { amount: -10_000, reason: "Negative" },
    { amount: 10.5, reason: "Fraction" },
  ])
    expect((await admin.note(customerId, bad)).status, JSON.stringify(bad)).toBe(400);
  expect(await entries(customerId)).toHaveLength(1);
});

test("credit notes need customer.manage: the accountant may, the cashier may not", async () => {
  const customerId = await addCustomer({ phone: "0271730003" });
  expect((await cashier.note(customerId, { amount: 1_000, reason: "Nope" })).status).toBe(403);
  expect((await accountant.note(customerId, { amount: 1_000, reason: "Goodwill" })).status).toBe(
    201,
  );
  expect(await entries(customerId)).toMatchObject([{ kind: "credit_note", amount: -1_000 }]);
});

test("a refund of a sale paid on account credits the account first, up to what the sale charged, then pays cash", async () => {
  const customerId = await verifiedCustomer(portal, 2_000_000, { phone: "0271730004" });
  counter = await startCounter();
  await counter.settle();
  // GH₵120 of goods: GH₵80 on account, GH₵40 in cash.
  const sold = await creditSale(counter, customerId, {
    units: 100,
    credit: 800_000,
    cash: 400_000,
  });
  await arrived(counter, sold.saleId);
  const lineId = sold.sale.lines[0].id as string;
  const returned = async (units: number) => {
    const reply = await counter!.ask({
      type: "refund.record",
      receipt: sold.receipt,
      lines: [{ lineId, quantityThousandths: units * 1000 }],
      reason: "Customer returned goods",
      tender: { kind: "cash" },
    });
    expect(reply).toMatchObject({ type: "result", kind: "refund" });
    const refundId = reply.refund.id as string;
    let saved: Record<string, any> | undefined;
    await expect
      .poll(
        async () => {
          await counter!.sync();
          const { rows } = await databases().db.execute<Record<string, any>>(sql`
            SELECT gross::int AS gross, account_credit::int AS account_credit, total::int AS total
            FROM refund WHERE org_id = ${ids.org} AND id = ${refundId}`);
          saved = rows[0];
          return saved;
        },
        { timeout: 20_000, interval: 250 },
      )
      .toBeDefined();
    return { refundId, saved: saved! };
  };

  // 40 units (GH₵48) are less than the GH₵80 charged: all of it goes to the account, no cash.
  const first = await returned(40);
  expect(first.saved).toEqual({ gross: 480_000, account_credit: 480_000, total: 0 });
  expect((await entries(customerId)).at(-1)).toMatchObject({
    kind: "credit_note",
    amount: -480_000,
    refund_id: first.refundId,
  });
  expect(await folds(customerId)).toMatchObject({ balance: 320_000 });

  // 50 units (GH₵60): the GH₵32 still owed is credited, the other GH₵28 is paid out.
  const second = await returned(50);
  expect(second.saved).toEqual({ gross: 600_000, account_credit: 320_000, total: 280_000 });
  expect((await entries(customerId)).at(-1)).toMatchObject({
    kind: "credit_note",
    amount: -320_000,
    refund_id: second.refundId,
  });
  expect(await folds(customerId)).toMatchObject({ balance: 0 });

  // Nothing is left to credit: the last 10 units are paid out in full and add no entry.
  const third = await returned(10);
  expect(third.saved).toEqual({ gross: 120_000, account_credit: 0, total: 120_000 });
  const ledger = await entries(customerId);
  expect(ledger.map((e) => e.kind)).toEqual(["charge", "credit_note", "credit_note"]);
  expect(ledger.some((e) => e.refund_id === third.refundId)).toBe(false);
  expect(await folds(customerId)).toMatchObject({ balance: 0 });
  expect(await chainValid()).toBe(true);
});
