import { createServer } from "node:http";
import { verifyWebhook } from "@shopper/core/payments/paystack";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { signWebhook, startPaystackFake } from "../../../../tooling/paystack/server";

let fake: Awaited<ReturnType<typeof startPaystackFake>>;
const received: Array<{ rawBody: string; signature: string | undefined }> = [];
const receiver = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  received.push({
    rawBody: Buffer.concat(chunks).toString("utf8"),
    signature: request.headers["x-paystack-signature"] as string | undefined,
  });
  response.writeHead(200).end();
});
let target: string;

beforeAll(async () => {
  fake = await startPaystackFake();
  fake.behave("0241234567", "pending");
  await fetch(`${fake.baseUrl}/charge`, {
    method: "POST",
    headers: { authorization: `Bearer ${fake.secretKey}` },
    body: JSON.stringify({
      reference: "wh-1",
      amount: 500,
      currency: "GHS",
      mobile_money: { phone: "0241234567", provider: "mtn" },
    }),
  });
  await new Promise<void>((resolve) => receiver.listen(0, "127.0.0.1", resolve));
  const address = receiver.address();
  target = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/webhooks/paystack`;
});
afterAll(async () => {
  await fake.stop();
  receiver.close();
});

describe("Paystack webhook signatures", () => {
  test("a webhook the fake signed is accepted for both events", async () => {
    for (const event of ["charge.success", "charge.failed"] as const) {
      await fake.deliverWebhook(target, { event, reference: "wh-1" });
      const { rawBody, signature } = received.at(-1)!;
      expect(await verifyWebhook(fake.secretKey, rawBody, signature)).toMatchObject({
        event,
        data: { reference: "wh-1", amount: 500 },
      });
    }
  });

  test("a body changed after signing is rejected", async () => {
    await fake.deliverWebhook(target, { event: "charge.success", reference: "wh-1" });
    const { rawBody, signature } = received.at(-1)!;
    const tampered = rawBody.replace('"amount":500', '"amount":5');
    expect(await verifyWebhook(fake.secretKey, tampered, signature)).toBeUndefined();
  });

  test("a wrong, malformed or missing signature is rejected", async () => {
    const { rawBody, signature } = received.at(-1)!;
    expect(
      await verifyWebhook(fake.secretKey, rawBody, signWebhook("other-key", rawBody)),
    ).toBeUndefined();
    expect(await verifyWebhook(fake.secretKey, rawBody, signature!.slice(2))).toBeUndefined();
    expect(await verifyWebhook(fake.secretKey, rawBody, "not-hex")).toBeUndefined();
    expect(await verifyWebhook(fake.secretKey, rawBody, undefined)).toBeUndefined();
  });

  test("a correctly signed event outside charge.success and charge.failed is ignored", async () => {
    const rawBody = JSON.stringify({ event: "transfer.success", data: { reference: "x" } });
    expect(
      await verifyWebhook(fake.secretKey, rawBody, signWebhook(fake.secretKey, rawBody)),
    ).toBeUndefined();
  });
});
