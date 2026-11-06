// Day 33: a paid order the store never accepts is compensated: refunded, its goods back on the shelf, its invoice
// credited and its books reversed, and the payer's money sent back once.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { refundOrderPayment } from "@shopper/core/orders";
import { orderPayWorld } from "../../../support/payments/orders";

let w: Awaited<ReturnType<typeof orderPayWorld>>;
beforeAll(async () => {
  w = await orderPayWorld({ acceptWithinMs: 700 });
}, 120_000);
afterAll(async () => {
  await w?.close();
});

const sumOf = (lines: Record<string, number>) => Object.values(lines).reduce((a, b) => a + b, 0);

test("a paid order the store never accepts is refunded in full and every trace of the sale is reversed", async () => {
  const order = await w.place();
  const reference = (await w.pay(order, { method: "card" })).body.payment.id as string;
  w.fake.knownCharge(reference, w.pesewas(order.gross));
  await w.paystackEvent(reference, w.pesewas(order.gross));
  expect((await w.row(order)).status).toBe("paid");

  await expect.poll(async () => (await w.row(order)).status, { timeout: 8_000 }).toBe("refunded");
  const [refund] = await w.refunds(order);
  expect(refund).toMatchObject({ reason: "not_accepted", amount: order.gross });
  // One Paystack refund of the whole payment, sent by the workflow's refund step.
  await expect.poll(async () => (await w.refunds(order))[0]!.providerReference).not.toBeNull();
  const requests = w.fake.requests.filter((request) => request.path === "/refund");
  expect(requests).toHaveLength(1);
  expect(requests[0]!.body).toMatchObject({
    transaction: reference,
    amount: w.pesewas(order.gross),
  });

  // The goods are back on the shelf: what left is exactly what returned.
  const moved = await w.movements(order);
  expect(moved.reduce((total, row) => total + row.quantityThousandths, 0)).toBe(0);
  expect(moved.filter((row) => row.reason === "return")).toHaveLength(2);

  // The books reverse the original entry line for line.
  const original = (await w.journal("order", order.id))!;
  const reversal = (await w.journal("reversal", refund!.id))!;
  expect(sumOf(reversal.lines)).toBe(0);
  expect(reversal.entry.reversesId).toBe(original.entry.id);
  for (const [account, amount] of Object.entries(original.lines))
    expect(reversal.lines[account]).toBe(-amount);

  // The invoice gets a credit note for the fiscal lane.
  const docs = await w.fiscal(order);
  expect(docs).toHaveLength(1);
  const note = await w.world.db.query.fiscalDoc.findFirst({
    where: (doc, { eq }) => eq(doc.orderRefundId, refund!.id),
  });
  expect(note).toMatchObject({ kind: "credit_note", status: "pending" });
  expect((note!.payload as { originalInvoiceNumber: string }).originalInvoiceNumber).toBe(
    (await w.row(order)).receiptNumber,
  );

  // Paystack settles it by webhook, once; asking to refund again sends nothing.
  const hook = w.fake.refundWebhook(
    (await w.refunds(order))[0]!.providerReference!,
    "refund.processed",
  );
  await w.http.request("/webhooks/paystack", {
    raw: hook.body,
    origin: null,
    headers: { "x-paystack-signature": hook.signature },
  });
  expect((await w.refunds(order))[0]!.status).toBe("processed");
  await refundOrderPayment({ ...w.deps, paystack: w.paystack }, refund!.id, w.world.a.orgId);
  expect(w.fake.requests.filter((request) => request.path === "/refund")).toHaveLength(1);
});

test("an order the store accepts in time is kept and nothing is refunded", async () => {
  const order = await w.place();
  const reference = (await w.pay(order, { method: "card" })).body.payment.id as string;
  w.fake.knownCharge(reference, w.pesewas(order.gross));
  await w.paystackEvent(reference, w.pesewas(order.gross));
  await w.orderFlows.send(order.id, "store.accepted", {});
  await expect.poll(async () => (await w.row(order)).status).toBe("accepted");
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  expect((await w.row(order)).status).toBe("accepted");
  expect(await w.refunds(order)).toHaveLength(0);
});
