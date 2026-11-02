// A refund posts the sale backwards in the same transaction: sales returns ex-tax and each levy debited, the payout
// credited to its tender, and restocked goods put back into inventory at their last received cost. Posting is
// keyed by the refund, so a replayed upload adds nothing.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { tradingDay } from "../../fixtures/sales/golden/day";
import { products } from "../../fixtures/sales/golden/references";
import { goldenWorld } from "../../support/sales/golden/setup";
import { runGolden } from "../../support/sales/golden/run";
import { postRefund, refundEvent } from "../../support/sales/refunds";
import { addDocument, addSupplier } from "../../support/stock/seed";
import { balances, entriesOf, trialBalanceZero } from "../../support/ledger/books";

let world: Awaited<ReturnType<typeof goldenWorld>>;
beforeAll(async () => {
  world = await goldenWorld();
  await addDocument({
    kind: "receipt",
    supplierId: await addSupplier("Refund Supplies"),
    on: "2026-10-01",
    at: "07:00",
    lines: [{ productId: products.standard.id, quantity: 10_000, unitCost: 40_000 }],
  });
});
afterAll(async () => world?.local.close());

test("a cash refund reverses revenue and levies, pays out of the drawer and restocks at cost", async () => {
  const sale = (await runGolden(
    world,
    tradingDay.find((s) => s.name === "cash with change")!,
  ))!;
  const event = refundEvent(world, sale, [{ line: 0, before: 0, after: 1_000 }], {
    tender: { kind: "cash" },
  });
  const posted = await postRefund(event, world.session.proof);
  expect(posted.body.accepted, JSON.stringify(posted.body)).toMatchObject({ id: event.refund.id });

  const [entry, ...more] = await entriesOf("refund", event.refund.id);
  expect(more).toHaveLength(0);
  const totals = event.refund.totals;
  expect(entry!.lines).toEqual({
    sales_returns: totals.gross - totals.vat - totals.nhil - totals.getfund - totals.covid,
    vat: totals.vat,
    nhil: totals.nhil,
    getfund: totals.getfund,
    cash_drawer: -event.refund.total,
    inventory: 40_000,
    cogs: -40_000,
    ...(event.refund.cashRounding ? { rounding: event.refund.cashRounding } : {}),
  });

  // Sold and returned: the levies owed net to nothing and the goods are back on the shelf at cost.
  const books = await balances();
  for (const levy of ["vat", "nhil", "getfund"]) expect(books.get(levy)).toBe(0);
  expect(books.get("inventory")).toBe(0);
  expect(books.get("cogs")).toBe(0);
  expect(books.get("sales")! + books.get("sales_returns")!).toBe(0);
  expect(await trialBalanceZero()).toBe(true);

  await postRefund(event, world.session.proof);
  expect(await entriesOf("refund", event.refund.id)).toHaveLength(1);
});

test("a card refund pays back through card clearing", async () => {
  const sale = (await runGolden(
    world,
    tradingDay.find((s) => s.name === "manual card")!,
  ))!;
  const event = refundEvent(world, sale, [{ line: 0, before: 0, after: 1_000 }]);
  expect((await postRefund(event, world.session.proof)).body.accepted).toMatchObject({
    id: event.refund.id,
  });
  const [entry] = await entriesOf("refund", event.refund.id);
  expect(entry!.lines.card_clearing).toBe(-event.refund.total);
  expect(entry!.lines.cash_drawer).toBeUndefined();
});
