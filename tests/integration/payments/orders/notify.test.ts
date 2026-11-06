// Day 33: the confirmation. A paid order texts the shopper and, with an address, emails the receipt; each goes out
// once however often the message is delivered, and a missing channel retries instead of dropping it.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { deliverNotification } from "@shopper/core/notifications";
import { orderPayWorld } from "../../../support/payments/orders/world";
import { deliveryOf } from "../../../support/payments/orders/reads";

let w: Awaited<ReturnType<typeof orderPayWorld>>;
beforeAll(async () => {
  w = await orderPayWorld();
}, 120_000);
afterAll(async () => {
  await w?.close();
});

const texts: { to: string[]; message: string }[] = [];
const mails: { email: string; subject: string; attachments: { fileName: string }[] }[] = [];
const channels = {
  sms: { send: async (to: string[], message: string) => void texts.push({ to, message }) } as never,
  mail: (async (mail: (typeof mails)[number]) => void mails.push(mail)) as never,
  renderer: { receipt: async () => new Uint8Array([37, 80, 68, 70]) } as never,
};
const paid = async (over: Record<string, unknown> = {}) => {
  const order = await w.place(over);
  const reference = (await w.pay(order, { method: "card" })).body.payment.id as string;
  w.fake.knownCharge(reference, w.pesewas(order.gross));
  const before = w.world.sent.length;
  await w.paystackEvent(reference, w.pesewas(order.gross));
  const message = w.world.sent
    .slice(before)
    .find((envelope) => envelope.type === "order.confirmation")!;
  return { order, message };
};

test("a paid order texts the shopper and emails the receipt, each once", async () => {
  const { order, message } = await paid({ email: "ama@example.com" });
  const deps = { db: w.world.db, appVersion: "test", ...channels };
  for (let i = 0; i < 2; i++) {
    const { delivery, answers } = deliveryOf(message);
    await deliverNotification(deps, delivery);
    expect(answers).toEqual({ ack: 1, retry: 0 });
  }
  const number = (await w.row(order)).receiptNumber!;
  expect(texts).toHaveLength(1);
  expect(texts[0]).toMatchObject({ to: ["0241234567"] });
  expect(texts[0]!.message).toContain(number);
  expect(mails).toHaveLength(1);
  expect(mails[0]).toMatchObject({ email: "ama@example.com" });
  expect(mails[0]!.attachments[0]!.fileName).toBe(`receipt-${number}.pdf`);
});

test("without an email address only the text goes out", async () => {
  texts.length = 0;
  mails.length = 0;
  const { message } = await paid();
  const { delivery, answers } = deliveryOf(message);
  await deliverNotification({ db: w.world.db, appVersion: "test", ...channels }, delivery);
  expect(answers).toEqual({ ack: 1, retry: 0 });
  expect(texts).toHaveLength(1);
  expect(mails).toHaveLength(0);
});

test("a shell without SMS credentials retries the message and sends nothing", async () => {
  texts.length = 0;
  const { order, message } = await paid();
  const { delivery, answers } = deliveryOf(message);
  await deliverNotification({ db: w.world.db, appVersion: "test" }, delivery);
  expect(answers).toEqual({ ack: 0, retry: 1 });
  expect(texts).toHaveLength(0);
  expect((await w.row(order)).smsSentAt).toBeNull();
});
