// Customer accounts in the books: the "Customer accounts" control account always equals what every customer owes by
// the credit ledger's fold. A credit sale debits it through its credit tender, a payment moves it into the drawer
// (or MoMo clearing), a credit note writes it off against sales returns, and monthly interest is account income.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import { postInterest } from "@shopper/core/customers";
import { goldenWorld } from "../../support/sales/golden/setup";
import { addCustomer } from "../../support/customers/seed";
import { uploader } from "../../support/customers/till";
import { setOrg } from "../../support/customers/due";
import { creditApi } from "../../support/customers/ledger";
import {
  creditHolds,
  creditSaleEvent,
  freshSale,
  pushSale,
  saleGross,
  sameTillSale,
} from "../../support/customers/credit";
import { portalOwner, type Portal } from "../../support/api/portal";
import { ids } from "../../support/till/sales";
import { databases } from "../../support/till/server";
import { balances, entriesOf, trialBalanceZero } from "../../support/ledger/books";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let admin: ReturnType<typeof creditApi>;
const holds = creditHolds();

beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  admin = creditApi(owner, owner.cookie);
  await setOrg({ credit_terms_days: 30, credit_interest_bps: 200 });
});
afterAll(async () => world?.local.close());

/** What every customer owes, by the credit ledger. */
async function owed() {
  const { rows } = await databases().db.execute<{ total: string }>(
    sql`SELECT COALESCE(SUM(amount), 0)::text AS total FROM credit_entry WHERE org_id = ${ids.org}`,
  );
  return Number(rows[0]!.total);
}

async function creditSale(customerId: string, first = false) {
  const created = first ? await freshSale() : await sameTillSale();
  const holdId = v7();
  const amount = saleGross(created);
  expect((await holds.create(await uploader(), customerId, amount, { id: holdId })).status).toBe(
    201,
  );
  const pushed = await pushSale(created, creditSaleEvent(created, customerId, holdId));
  expect(pushed.body.rejected, JSON.stringify(pushed.body)).toEqual([]);
  return { saleId: created.event.sale.id, amount };
}

test("the customer-accounts control account equals what customers owe, entry by entry", async () => {
  const ama = await addCustomer({ creditLimit: 5_000_000, phone: "0271830001" });
  const kofi = await addCustomer({ creditLimit: 5_000_000, phone: "0271830002" });

  const bought = await creditSale(ama, true);
  await creditSale(kofi);
  expect((await entriesOf("sale", bought.saleId))[0]!.lines.receivables).toBe(bought.amount);
  expect((await balances()).get("receivables")).toBe(await owed());

  const cash = { id: v7(), amount: 50_000, method: "cash" };
  expect((await admin.pay(ama, cash)).status).toBe(201);
  expect((await entriesOf("credit", cash.id))[0]!.lines).toEqual({
    cash_drawer: 50_000,
    receivables: -50_000,
  });
  const momo = { id: v7(), amount: 20_000, method: "momo" };
  expect((await admin.pay(kofi, momo)).status).toBe(201);
  expect((await entriesOf("credit", momo.id))[0]!.lines.momo_clearing).toBe(20_000);
  // A replayed payment posts nothing more.
  expect((await admin.pay(ama, cash)).status).toBe(200);
  expect(await entriesOf("credit", cash.id)).toHaveLength(1);

  expect((await admin.note(ama, { amount: 10_000, reason: "Damaged on delivery" })).status).toBe(
    201,
  );
  const interest = await postInterest(databases().db, databases().context, {
    customerId: kofi,
    at: new Date("2026-03-01T00:00:00Z"),
  });
  expect(interest).toMatchObject({ posted: true });

  const books = await balances({ source: "credit" });
  expect(books.get("sales_returns")).toBe(10_000);
  expect(books.get("interest")).toBe(-interest.amount);
  expect((await balances()).get("receivables")).toBe(await owed());
  expect(await trialBalanceZero()).toBe(true);
});
