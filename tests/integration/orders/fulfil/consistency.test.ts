// Day 34 done-when: order -> pay -> accept -> pick -> substitute -> fulfil leaves stock, money and fiscal documents
// consistent. The order: 2 oil at 30.00 and 1.5 kg rice at 18.50 = GHS 87.75, prices tax-inclusive.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import {
  handOverStoreOrder,
  finishStoreOrder,
  startPicking,
  recordPick,
} from "@shopper/core/orders";
import { acceptStoreOrder, cancelStoreOrder } from "@shopper/core/orders";
import { fulfilWorld } from "../../../support/orders/fulfil";

let f: Awaited<ReturnType<typeof fulfilWorld>>;
beforeAll(async () => {
  f = await fulfilWorld({ acceptWithinMs: 30_000, pickLeadMs: 0 });
}, 120_000);
afterAll(async () => {
  await f?.close();
});

/** A paid, accepted order with its slot a moment away, ready for the picker. */
const accepted = async () => {
  const order = await f.paid();
  await f.slotIn(order, 300, 120_000);
  await acceptStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  const [oil, rice] = await f.lines(order);
  await startPicking(f.world.db, f.ctx, { id: order.id });
  return { order, oil: oil!, rice: rice! };
};
const net = async (order: { id: string }) => {
  const totals = new Map<string, number>();
  for (const row of await f.movements(order))
    totals.set(row.productId, (totals.get(row.productId) ?? 0) + row.quantityThousandths);
  return totals;
};
/** Every journal entry that belongs to the order, summed account by account. */
const books = async (order: { id: string }) => {
  const adjustment = await f.adjustment(order);
  const original = (await f.journal("order", order.id))!;
  const extra = adjustment ? await f.journal("order", adjustment.id) : undefined;
  const sum = (entry?: typeof original) => entry?.lines ?? {};
  const total: Record<string, number> = {};
  for (const [account, amount] of [...Object.entries(sum(original)), ...Object.entries(sum(extra))])
    total[account] = (total[account] ?? 0) + amount;
  return { original, extra, total };
};
const payloadOf = async (id: string | null | undefined) =>
  (await f.world.db.query.fiscalDoc.findFirst({
    where: (doc, { eq: same }) =>
      same(doc.adjustmentCreditId, id ?? "") || same(doc.adjustmentInvoiceId, id ?? ""),
  }))!.payload as { totals: { net: number; total: number }; originalInvoiceNumber: string | null };

test("short on oil with a cheaper substitute, short on rice: stock, books, invoices and the refund agree", async () => {
  const { order, oil, rice } = await accepted();
  const before = f.refundCalls().length;
  // One of two oils (GHS 30.00 short), replaced by palm oil at 25.00; 1 of 1.5 kg rice (GHS 9.25 short), no substitute.
  await recordPick(f.world.db, f.ctx, {
    id: order.id,
    lineId: oil.id,
    pickedThousandths: 1_000,
    substitute: { productId: f.substitutes.palm, quantityThousandths: 1_000 },
  });
  await recordPick(f.world.db, f.ctx, { id: order.id, lineId: rice.id, pickedThousandths: 1_000 });
  await finishStoreOrder(f.world.db, f.ctx, f.flows, order.id);

  const row = await f.row(order);
  expect(row.status).toBe("ready");
  expect(row.fulfilledGross).toBe(735_000);
  const adjustment = (await f.adjustment(order))!;
  expect(adjustment).toMatchObject({
    beforeGross: 877_500,
    afterGross: 735_000,
    refundAmount: 142_500,
  });

  // Stock: oil sold 2 and returned 1; rice sold 1.5 and returned 0.5; one palm oil sold.
  const stock = await net(order);
  expect(stock.get(f.products.oil)).toBe(-1_000);
  expect(stock.get(f.products.rice)).toBe(-1_000);
  expect(stock.get(f.substitutes.palm)).toBe(-1_000);

  // Money: the payer is owed back exactly the difference, asked of Paystack once however often the message comes.
  expect(await f.refunds(order)).toMatchObject([{ reason: "short_pick", amount: 142_500 }]);
  await f.sendRefunds();
  await f.sendRefunds();
  const calls = f.refundCalls().slice(before);
  expect(calls).toHaveLength(1);
  expect(calls[0]!.body).toMatchObject({ amount: f.pesewas(142_500) });

  // Books: each entry balances, and together the order is worth what the shopper finally pays.
  const { extra, total } = await books(order);
  expect(Object.values(extra!.lines).reduce((a, b) => a + b, 0)).toBe(0);
  expect(total.card_clearing).toBe(735_000);
  const takings = ["sales", "vat", "nhil", "getfund", "covid"].reduce(
    (sum, account) => sum + (total[account] ?? 0),
    0,
  );
  expect(takings).toBe(-735_000);

  // Fiscal: a credit note for what was not delivered and an invoice for the substitute, tax broken out and agreeing.
  const credit = await payloadOf(adjustment.id);
  const invoices = await f.world.db
    .select()
    .from(schema.fiscalDoc)
    .where(eq(schema.fiscalDoc.adjustmentInvoiceId, adjustment.id));
  expect(credit.totals.total).toBe(392_500);
  expect(credit.originalInvoiceNumber).toBe(row.receiptNumber);
  expect(invoices).toHaveLength(1);
  expect(invoices[0]!.kind).toBe("invoice");
  expect((invoices[0]!.payload as { totals: { total: number } }).totals.total).toBe(250_000);
  expect(adjustment.creditNoteNumber).toBe(`${row.receiptNumber}-A`);
  expect(adjustment.supplementNumber).toBe(`${row.receiptNumber}-S`);

  // Finishing again changes nothing: no second refund, no second set of documents.
  await expect(finishStoreOrder(f.world.db, f.ctx, f.flows, order.id)).rejects.toMatchObject({
    code: "conflict",
  });
  expect(await f.refunds(order)).toHaveLength(1);
  expect((await net(order)).get(f.substitutes.palm)).toBe(-1_000);

  // The run follows the order to its end.
  await handOverStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  await expect
    .poll(async () => (await f.run(order))?.status, { timeout: 10_000 })
    .toBe("completed");
  expect((await f.row(order)).status).toBe("completed");
});

test("a substitute dearer than what is missing is charged no more than what is missing", async () => {
  const { order, oil, rice } = await accepted();
  await recordPick(f.world.db, f.ctx, { id: order.id, lineId: oil.id, pickedThousandths: 2_000 });
  // 0.5 kg short (GHS 9.25); basmati at 40.00 a kg for 1 kg would cost 40.00, so the shopper pays 9.25.
  await recordPick(f.world.db, f.ctx, {
    id: order.id,
    lineId: rice.id,
    pickedThousandths: 1_000,
    substitute: { productId: f.substitutes.basmati, quantityThousandths: 1_000 },
  });
  await finishStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  const adjustment = (await f.adjustment(order))!;
  expect(adjustment).toMatchObject({ afterGross: 877_500, refundAmount: 0, refundId: null });
  expect(await f.refunds(order)).toHaveLength(0);
  expect((await payloadOf(adjustment.id)).totals.total).toBe(92_500);
  const [invoice] = await f.world.db
    .select()
    .from(schema.fiscalDoc)
    .where(eq(schema.fiscalDoc.adjustmentInvoiceId, adjustment.id));
  expect((invoice!.payload as { totals: { total: number } }).totals.total).toBe(92_500);
  expect((await books(order)).total.card_clearing).toBe(877_500);
});

test("a substitute the branch has none of is refused, and the pick stays open", async () => {
  const { order, oil } = await accepted();
  await expect(
    recordPick(f.world.db, f.ctx, {
      id: order.id,
      lineId: oil.id,
      pickedThousandths: 1_000,
      substitute: { productId: f.substitutes.scarce, quantityThousandths: 1_000 },
    }),
  ).rejects.toMatchObject({ code: "stock" });
  expect(await f.picks(order)).toHaveLength(0);
});

test("an order picked in full changes nothing: no adjustment, no refund, no extra documents", async () => {
  const { order, oil, rice } = await accepted();
  await recordPick(f.world.db, f.ctx, { id: order.id, lineId: oil.id, pickedThousandths: 2_000 });
  await recordPick(f.world.db, f.ctx, { id: order.id, lineId: rice.id, pickedThousandths: 1_500 });
  await finishStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  expect((await f.row(order)).status).toBe("ready");
  expect((await f.row(order)).fulfilledGross).toBeNull();
  expect(await f.adjustment(order)).toBeUndefined();
  expect(await f.refunds(order)).toHaveLength(0);
  expect(await f.fiscal(order)).toHaveLength(1);
});

test("picking rules: every line first, no more than was ordered, and an order with nothing picked is a cancel", async () => {
  const { order, oil, rice } = await accepted();
  await expect(finishStoreOrder(f.world.db, f.ctx, f.flows, order.id)).rejects.toMatchObject({
    code: "conflict",
  });
  await expect(
    recordPick(f.world.db, f.ctx, { id: order.id, lineId: oil.id, pickedThousandths: 3_000 }),
  ).rejects.toMatchObject({ code: "conflict" });
  await recordPick(f.world.db, f.ctx, { id: order.id, lineId: oil.id, pickedThousandths: 0 });
  await recordPick(f.world.db, f.ctx, { id: order.id, lineId: rice.id, pickedThousandths: 0 });
  await expect(finishStoreOrder(f.world.db, f.ctx, f.flows, order.id)).rejects.toMatchObject({
    code: "conflict",
  });
  expect((await f.row(order)).status).toBe("picking");
  // Picking an order that is not being picked is refused.
  const other = await f.paid();
  const [line] = await f.lines(other);
  await expect(
    recordPick(f.world.db, f.ctx, { id: other.id, lineId: line!.id, pickedThousandths: 1_000 }),
  ).rejects.toMatchObject({ code: "conflict" });
});

test("an order cancelled after it was adjusted refunds only what is left, and every account nets to nothing", async () => {
  const { order, oil, rice } = await accepted();
  await recordPick(f.world.db, f.ctx, {
    id: order.id,
    lineId: oil.id,
    pickedThousandths: 1_000,
    substitute: { productId: f.substitutes.palm, quantityThousandths: 1_000 },
  });
  await recordPick(f.world.db, f.ctx, { id: order.id, lineId: rice.id, pickedThousandths: 1_500 });
  await finishStoreOrder(f.world.db, f.ctx, f.flows, order.id);
  await cancelStoreOrder(f.world.db, f.ctx, f.flows, order.id);

  const refunds = await f.refunds(order);
  expect(refunds.map((refund) => [refund.reason, refund.amount]).sort()).toEqual([
    ["cancelled", 877_500 - 50_000],
    ["short_pick", 50_000],
  ]);
  for (const stock of (await net(order)).values()) expect(stock).toBe(0);
  const adjustment = (await f.adjustment(order))!;
  const reversal = (await f.journal(
    "reversal",
    refunds.find((r) => r.reason === "cancelled")!.id,
  ))!;
  const { total } = await books(order);
  for (const [account, amount] of Object.entries(total))
    expect((amount ?? 0) + (reversal.lines[account] ?? 0)).toBe(0);
  // The credit note for the cancel covers the goods as picked, not as first ordered.
  const [note] = await f.world.db
    .select()
    .from(schema.fiscalDoc)
    .where(eq(schema.fiscalDoc.orderRefundId, refunds.find((r) => r.reason === "cancelled")!.id));
  expect((note!.payload as { totals: { total: number } }).totals.total).toBe(827_500);
  expect(adjustment.afterGross).toBe(827_500);
});
