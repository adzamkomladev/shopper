import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { boxMomoPayment } from "@shopper/adapters-box";
import { createHubtel } from "@shopper/core/payments/hubtel";
import * as schema from "@shopper/db-pg";
import type { Envelope } from "@shopper/ports";
import { momoFixture } from "../../support/payments/momo";
import { startHubtelFake } from "../../../tooling/hubtel/server";

let f: Awaited<ReturnType<typeof momoFixture>>;
let fake: Awaited<ReturnType<typeof startHubtelFake>>;
const published: Envelope[] = [];
let api: ReturnType<typeof f.withLauncher>;
beforeAll(async () => {
  f = await momoFixture();
  fake = await startHubtelFake();
  const hubtel = createHubtel({
    clientId: fake.clientId,
    clientSecret: fake.clientSecret,
    merchantAccount: fake.merchantAccount,
    callbackUrl: "https://shopper.test/webhooks/hubtel",
    baseUrl: fake.baseUrl,
    statusUrl: fake.baseUrl,
  });
  api = f.withLauncher(
    boxMomoPayment({ ...f.deps, hubtel, timeoutMs: 60_000 }),
    { ...f.realtime, publish: async (_org, _store, envelope) => void published.push(envelope) },
    { hubtel },
  );
});
afterAll(async () => {
  await fake?.stop();
  await f?.close();
});

const provider = (momoProvider: "paystack" | "hubtel") =>
  f.db.update(schema.org).set({ momoProvider }).where(eq(schema.org.id, f.orgId));
const start = async (amount: number, phone = "0241234567") => {
  const reply = await api.request("/payments/momo", {
    method: "POST",
    headers: f.headers,
    body: JSON.stringify({ amount, phone, network: "mtn" }),
  });
  expect(reply.status).toBe(201);
  return ((await reply.json()) as { reference: string }).reference;
};
const callback = (body: unknown) =>
  api.request("/webhooks/hubtel", { method: "POST", body: JSON.stringify(body) });
const read = async (reference: string) =>
  (await f.db.select().from(schema.payment).where(eq(schema.payment.reference, reference)))[0]!;
const charged = (reference: string) =>
  vi.waitFor(() => {
    const found = fake.requests.find(
      (r) => (r.body as { ClientReference?: string } | undefined)?.ClientReference === reference,
    );
    expect(found).toBeDefined();
    return found!;
  });

test("an org on Hubtel charges decimal cedis, and only the status API confirms the payment, once", async () => {
  await provider("hubtel");
  const reference = await start(125_000);
  const request = await charged(reference);
  expect(request.raw).toContain('"Amount":12.50');
  expect(request.body).toMatchObject({ CustomerMsisdn: "233241234567", Channel: "mtn-gh" });
  expect(await read(reference)).toMatchObject({ provider: "hubtel", status: "pending" });

  // An unsigned callback claiming success changes nothing while Hubtel still says Unpaid.
  expect((await callback(fake.callback(reference, true))).status).toBe(200);
  expect((await read(reference)).status).toBe("pending");

  fake.settle(reference, "Paid");
  for (let attempt = 0; attempt < 3; attempt++)
    expect((await callback(fake.callback(reference, true))).status).toBe(200);
  expect(await read(reference)).toMatchObject({ status: "confirmed", providerReference: "HT1" });
  const events = await f.db
    .select()
    .from(schema.paymentEvent)
    .where(eq(schema.paymentEvent.reference, reference));
  expect(events).toMatchObject([{ provider: "hubtel", kind: "hubtel.confirmed" }]);
  expect(
    published.filter(
      (e) =>
        e.type === "payment.updated" &&
        (e.payload as { reference: string }).reference === reference,
    ),
  ).toHaveLength(1);
});

test("a Hubtel payment collected for a different amount is refused", async () => {
  await provider("hubtel");
  const reference = await start(50_000);
  await charged(reference);
  fake.settle(reference, "Paid", 4.99);
  expect((await callback(fake.callback(reference, true))).status).toBe(400);
  expect((await read(reference)).status).toBe("pending");
});

test("a Paystack org is untouched by the Hubtel setting of another payment", async () => {
  await provider("paystack");
  const before = fake.requests.length;
  const reference = await start(10_000, "0551234987");
  await vi.waitFor(async () => expect((await read(reference)).status).toBe("confirmed"));
  expect(await read(reference)).toMatchObject({ provider: "paystack" });
  expect(fake.requests).toHaveLength(before);
});

test("an org on Hubtel without Hubtel credentials fails the payment with a reason", async () => {
  await provider("hubtel");
  const bare = f.withLauncher(boxMomoPayment(f.deps));
  const reply = await bare.request("/payments/momo", {
    method: "POST",
    headers: f.headers,
    body: JSON.stringify({ amount: 10_000, phone: "0241234567", network: "mtn" }),
  });
  const { reference } = (await reply.json()) as { reference: string };
  await vi.waitFor(async () => expect((await read(reference)).status).toBe("failed"));
  expect((await read(reference)).failureReason).toContain("Hubtel is not set up");
  await provider("paystack");
});

test("a Hubtel payment found paid for a different amount when its wait runs out is failed", async () => {
  await provider("hubtel");
  const hubtel = createHubtel({
    clientId: fake.clientId,
    clientSecret: fake.clientSecret,
    merchantAccount: fake.merchantAccount,
    callbackUrl: "https://shopper.test/webhooks/hubtel",
    baseUrl: fake.baseUrl,
    statusUrl: fake.baseUrl,
  });
  const quick = f.withLauncher(boxMomoPayment({ ...f.deps, hubtel, timeoutMs: 400 }), f.realtime, {
    hubtel,
  });
  const reply = await quick.request("/payments/momo", {
    method: "POST",
    headers: f.headers,
    body: JSON.stringify({ amount: 50_000, phone: "0241234567", network: "mtn" }),
  });
  const { reference } = (await reply.json()) as { reference: string };
  await charged(reference);
  fake.settle(reference, "Paid", 4.99);
  await vi.waitFor(async () => expect((await read(reference)).status).toBe("failed"), {
    timeout: 5000,
  });
  expect((await read(reference)).failureReason).toContain("different amount");
  await provider("paystack");
});
