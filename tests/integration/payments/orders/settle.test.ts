// Day 33: a shopper pays for a placed order. A card opens Paystack's page for the shop's payout account; the signed
// webhook that follows pays and invoices the order in one transaction. Replays, wrong signatures and wrong amounts
// change nothing.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { orderPayWorld } from "../../../support/payments/orders/world";

let w: Awaited<ReturnType<typeof orderPayWorld>>;
beforeAll(async () => {
  w = await orderPayWorld();
}, 120_000);
afterAll(async () => {
  await w?.close();
});

const sumOf = (lines: Record<string, number>) => Object.values(lines).reduce((a, b) => a + b, 0);

test("paying by card opens Paystack for exactly the order's total and returns the shopper to their order", async () => {
  const order = await w.place({ email: "ama@example.com" });
  const paid = await w.pay(order);
  expect(paid.status).toBe(202);
  expect(paid.body.payment).toMatchObject({
    method: "card",
    provider: "paystack",
    status: "pending",
  });
  const reference = paid.body.payment.id as string;
  expect(paid.body.payment.checkoutUrl).toBe(`https://checkout.paystack.test/${reference}`);
  const initialised = w.fake.requests.find(
    (request) =>
      request.path === "/transaction/initialize" &&
      (request.body as { reference: string }).reference === reference,
  )!.body as Record<string, unknown>;
  expect(initialised).toMatchObject({
    amount: w.pesewas(order.gross),
    currency: "GHS",
    email: "ama@example.com",
  });
  expect(initialised.callback_url).toBe(
    `https://shop.test/${w.world.a.slug}/orders/${order.id}?t=${order.key}`,
  );
  // Asking again returns the same open attempt rather than a second Paystack page.
  const again = await w.pay(order);
  expect(again.body.payment.id).toBe(reference);
  expect(
    w.fake.requests.filter((request) => request.path === "/transaction/initialize"),
  ).toHaveLength(1);
});

test("a stranger without the checkout key cannot pay or read the order", async () => {
  const order = await w.place();
  const wrong = await w.pay({ id: order.id, key: crypto.randomUUID() });
  expect(wrong.status).toBe(404);
  expect(await w.payments(order)).toHaveLength(0);
});

test("the signed webhook pays and invoices the order in one go: receipt, fiscal document, books, stock, confirmation", async () => {
  const order = await w.place({ email: "ama@example.com" });
  const reference = (await w.pay(order)).body.payment.id as string;
  w.fake.knownCharge(reference, w.pesewas(order.gross));
  const before = w.world.sent.length;
  expect((await w.paystackEvent(reference, w.pesewas(order.gross))).status).toBe(200);

  const paid = await w.row(order);
  expect(paid.status).toBe("paid");
  expect(paid.receiptNumber).toMatch(/-W-\d{6}$/);
  expect(paid.paidAt).not.toBeNull();
  expect((await w.payments(order))[0]).toMatchObject({ status: "confirmed" });

  // The invoice: one pending VAT document carrying the order's own tax snapshot.
  const docs = await w.fiscal(order);
  expect(docs).toHaveLength(1);
  expect(docs[0]).toMatchObject({
    kind: "invoice",
    status: "pending",
    invoiceNumber: paid.receiptNumber,
  });
  expect((docs[0]!.payload as { totals: { total: number; vat: number } }).totals).toMatchObject({
    total: paid.gross,
    vat: paid.vat,
  });

  // The books: one balanced entry, the card's money in against sales and each levy.
  const entry = (await w.journal("order", order.id))!;
  expect(sumOf(entry.lines)).toBe(0);
  expect(entry.lines.card_clearing).toBe(paid.gross);
  expect(entry.lines.vat).toBe(-paid.vat);

  // The goods leave the shelf and the held stock is given up.
  const moved = await w.movements(order);
  expect(moved.map((row) => [row.reason, row.quantityThousandths]).sort()).toEqual(
    [
      ["sale", -2_000],
      ["sale", -1_500],
    ].sort(),
  );
  expect((await w.holds(order)).every((hold) => hold.releaseReason === "fulfilled")).toBe(true);

  // The confirmation is queued for after the commit, and every step is audited.
  expect(w.world.sent.slice(before).map((envelope) => envelope.type)).toEqual([
    "order.confirmation",
  ]);
  const audits = await w.world.db
    .select({ command: schema.auditLog.command })
    .from(schema.auditLog)
    .where(
      and(eq(schema.auditLog.orgId, w.world.a.orgId), eq(schema.auditLog.entityId, reference)),
    );
  expect(audits.map((row) => row.command)).toContain("order.payment.start");
  // The order's workflow wakes and carries on to wait for the store.
  await expect
    .poll(async () => {
      const [run] = await w.world.db
        .select()
        .from(schema.workflowRun)
        .where(eq(schema.workflowRun.instanceId, order.id));
      return run?.currentStep;
    })
    .toBe("paid");
});

test("a replayed webhook changes nothing", async () => {
  const order = await w.place();
  const reference = (await w.pay(order)).body.payment.id as string;
  w.fake.knownCharge(reference, w.pesewas(order.gross));
  await w.paystackEvent(reference, w.pesewas(order.gross));
  const sent = w.world.sent.length;
  expect((await w.paystackEvent(reference, w.pesewas(order.gross))).status).toBe(200);
  expect(await w.fiscal(order)).toHaveLength(1);
  expect((await w.movements(order)).length).toBe(2);
  expect(await w.refunds(order)).toHaveLength(0);
  expect(w.world.sent.length).toBe(sent);
});

test("a webhook with the wrong signature or the wrong amount pays nothing", async () => {
  const order = await w.place();
  const reference = (await w.pay(order)).body.payment.id as string;
  expect(
    (await w.paystackEvent(reference, w.pesewas(order.gross), "charge.success", "sk_other")).status,
  ).toBe(401);
  expect((await w.paystackEvent(reference, w.pesewas(order.gross) - 100)).status).toBe(400);
  expect((await w.row(order)).status).toBe("placed");
  expect(await w.fiscal(order)).toHaveLength(0);
  expect((await w.payments(order))[0]!.status).toBe("pending");
});

test("mobile money is prompted through Paystack and a approved prompt pays the order", async () => {
  w.fake.behave("0551234987", "success");
  const order = await w.place();
  const paid = await w.pay(order, { method: "momo", network: "mtn", phone: "0551234987" });
  expect(paid.status).toBe(202);
  await expect.poll(async () => (await w.row(order)).status).toBe("paid");
  expect((await w.fiscal(order))[0]?.kind).toBe("invoice");
  expect((await w.journal("order", order.id))!.lines.momo_clearing).toBe(
    (await w.row(order)).gross,
  );
});

test("the same order cannot be paid once it is paid", async () => {
  const order = await w.place();
  const reference = (await w.pay(order)).body.payment.id as string;
  w.fake.knownCharge(reference, w.pesewas(order.gross));
  await w.paystackEvent(reference, w.pesewas(order.gross));
  expect((await w.pay(order)).status).toBe(409);
});
