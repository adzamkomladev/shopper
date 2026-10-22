// Payments on account, the credit limit and the statement, from the back office. A balance is the fold of the
// append-only credit ledger: positive is owed, negative is a deposit. Ghana is UTC+0, so a date is a UTC day.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { ids } from "../../../support/till/sales";
import { databases } from "../../../support/till/server";
import { portalMember, portalOwner, type Portal } from "../../../support/api/portal";
import { customerApi } from "../../../support/customers/http";
import { addCreditEntry, addCustomer, folds } from "../../../support/customers/seed";
import {
  addEntryAt,
  auditCommands,
  chainValid,
  creditApi,
  entries,
  failure,
} from "../../../support/customers/ledger";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let admin: ReturnType<typeof creditApi>;
let cashier: ReturnType<typeof creditApi>;
let accountant: ReturnType<typeof creditApi>;
let inventory: ReturnType<typeof creditApi>;
let reader: ReturnType<typeof customerApi>;

beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  admin = creditApi(owner, owner.cookie);
  reader = customerApi(owner, owner.cookie);
  cashier = creditApi(owner, await portalMember(owner, "cashier"));
  accountant = creditApi(owner, await portalMember(owner, "accountant"));
  inventory = creditApi(owner, await portalMember(owner, "inventory"));
});
afterAll(async () => world?.local.close());

test("a cash payment lowers the balance, is audited, and a replay by client id changes nothing", async () => {
  const customerId = await addCustomer({ creditLimit: 1_000_000, phone: "0271720001" });
  await addCreditEntry(customerId, "charge", 400_000);
  const body = { id: v7(), amount: 250_000, method: "cash" };
  const paid = await admin.pay(customerId, body);
  expect(paid.status).toBe(201);
  expect(paid.body).toMatchObject({ id: customerId, balance: 150_000 });
  expect(await entries(customerId)).toMatchObject([
    { kind: "charge", amount: 400_000 },
    { kind: "payment", amount: -250_000, method: "cash", actor_id: owner.principal.userId },
  ]);
  expect((await auditCommands(customerId)).filter((c) => /payment/.test(c))).toHaveLength(1);
  expect(await chainValid()).toBe(true);

  expect((await admin.pay(customerId, body)).status).toBe(200);
  expect((await admin.pay(customerId, { ...body, amount: 1_000 })).status).toBe(409);
  expect(await entries(customerId)).toHaveLength(2);
  expect(await folds(customerId)).toMatchObject({ balance: 150_000 });
});

test("a payment beyond what is owed is a deposit and shows as a negative balance; MoMo is accepted too", async () => {
  const customerId = await addCustomer({ phone: "0271720002" });
  expect((await admin.pay(customerId, { id: v7(), amount: 500_000, method: "momo" })).status).toBe(
    201,
  );
  expect((await reader.read(customerId)).body).toMatchObject({ balance: -500_000 });
  expect(await entries(customerId)).toMatchObject([
    { kind: "payment", amount: -500_000, method: "momo" },
  ]);
});

test("a payment needs a positive whole amount and a cash or MoMo method, and writes nothing otherwise", async () => {
  const customerId = await addCustomer({ phone: "0271720003" });
  for (const bad of [
    { id: v7(), amount: 0, method: "cash" },
    { id: v7(), amount: -100, method: "cash" },
    { id: v7(), amount: 100.5, method: "cash" },
    { id: v7(), amount: 100, method: "card" },
    { id: v7(), amount: 100 },
  ])
    expect((await admin.pay(customerId, bad)).status, JSON.stringify(bad)).toBe(400);
  expect(await entries(customerId)).toEqual([]);
});

test("payments need customer.manage: the accountant may, the cashier may not; unknown and foreign customers are 404", async () => {
  const customerId = await addCustomer({ phone: "0271720004" });
  expect((await cashier.pay(customerId, { id: v7(), amount: 1_000, method: "cash" })).status).toBe(
    403,
  );
  expect(
    (await inventory.pay(customerId, { id: v7(), amount: 1_000, method: "cash" })).status,
  ).toBe(403);
  expect(
    (await accountant.pay(customerId, { id: v7(), amount: 1_000, method: "cash" })).status,
  ).toBe(201);
  expect((await admin.pay(v7(), { id: v7(), amount: 1_000, method: "cash" })).status).toBe(404);
  const foreign = await addCustomer({ orgId: ids.otherOrg });
  expect((await admin.pay(foreign, { id: v7(), amount: 1_000, method: "cash" })).status).toBe(404);
  expect(await entries(customerId)).toHaveLength(1);
});

test("a credit limit can be set only for a KYC-verified customer, and needs customer.manage", async () => {
  const verified = await addCustomer({ creditLimit: 500_000, phone: "0271720005" });
  const unverified = await addCustomer({ phone: "0271720006" });
  expect((await admin.limit(verified, 2_000_000)).body).toMatchObject({
    id: verified,
    creditLimit: 2_000_000,
  });
  expect((await accountant.limit(verified, 0)).body).toMatchObject({ creditLimit: 0 });
  expect((await cashier.limit(verified, 1_000)).status).toBe(403);
  for (const bad of [-1, 1.5, "lots"]) expect((await admin.limit(verified, bad)).status).toBe(400);

  expect((await admin.limit(unverified, 100_000)).status).toBe(409);
  const { rows } = await databases().db.execute<{ credit_limit: string }>(
    sql`SELECT credit_limit::text FROM customer WHERE id = ${unverified}`,
  );
  expect(rows[0]!.credit_limit).toBe("0");
  expect((await reader.read(verified)).body).toMatchObject({ creditLimit: 0 });
});

test("the statement gives the opening balance, entries with a running balance and the closing balance", async () => {
  const customerId = await addCustomer({ creditLimit: 1_000_000, phone: "0271720007" });
  await addEntryAt(customerId, "charge", 500_000, "2026-09-10T09:00:00Z");
  await addEntryAt(customerId, "payment", -100_000, "2026-09-20T09:00:00Z");
  await addEntryAt(customerId, "charge", 10_000, "2026-10-01T00:00:00Z");
  await addEntryAt(customerId, "charge", 200_000, "2026-10-05T09:00:00Z");
  await addEntryAt(customerId, "credit_note", -50_000, "2026-10-12T09:00:00Z");
  await addEntryAt(customerId, "payment", -700_000, "2026-10-31T23:30:00Z");
  await addEntryAt(customerId, "charge", 80_000, "2026-11-03T09:00:00Z");

  const statement = await accountant.statement(customerId, "from=2026-10-01&to=2026-10-31");
  expect(statement.status).toBe(200);
  expect(statement.body.opening).toBe(400_000);
  expect(statement.body.entries.map((e: any) => [e.kind, e.amount, e.balance])).toEqual([
    ["charge", 10_000, 410_000],
    ["charge", 200_000, 610_000],
    ["credit_note", -50_000, 560_000],
    ["payment", -700_000, -140_000],
  ]);
  // More paid than owed at the end of October: the closing balance is a deposit.
  expect(statement.body.closing).toBe(-140_000);

  const november = await accountant.statement(customerId, "from=2026-11-01&to=2026-11-30");
  expect(november.body.opening).toBe(-140_000);
  expect(november.body.entries.map((e: any) => [e.kind, e.balance])).toEqual([["charge", -60_000]]);
  expect(november.body.closing).toBe(-60_000);

  const empty = await accountant.statement(customerId, "from=2026-01-01&to=2026-01-31");
  expect(empty.body).toMatchObject({ opening: 0, entries: [], closing: 0 });
});

test("a statement needs valid dates and customer.read, and never shows another org's customer", async () => {
  const customerId = await addCustomer({ phone: "0271720008" });
  for (const query of ["from=yesterday&to=2026-10-31", "from=2026-10-31&to=2026-10-01"])
    expect((await admin.statement(customerId, query)).status, query).toBe(400);
  expect((await cashier.statement(customerId, "from=2026-10-01&to=2026-10-31")).status).toBe(200);
  expect((await inventory.statement(customerId, "from=2026-10-01&to=2026-10-31")).status).toBe(403);
  const foreign = await addCustomer({ orgId: ids.otherOrg });
  expect((await admin.statement(foreign, "from=2026-10-01&to=2026-10-31")).status).toBe(404);
});

test("the credit ledger is immutable: UPDATE and DELETE raise and the fold is unchanged", async () => {
  const customerId = await addCustomer({ phone: "0271720009" });
  expect((await admin.pay(customerId, { id: v7(), amount: 70_000, method: "cash" })).status).toBe(
    201,
  );
  const { db } = databases();
  expect(
    await failure(
      db.execute(sql`UPDATE credit_entry SET amount = -1 WHERE customer_id = ${customerId}`),
    ),
  ).toMatch(/append-only/);
  expect(
    await failure(db.execute(sql`DELETE FROM credit_entry WHERE customer_id = ${customerId}`)),
  ).toMatch(/append-only/);
  expect(await folds(customerId)).toMatchObject({ balance: -70_000 });
});
