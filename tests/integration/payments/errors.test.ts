import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { workflowRun } from "@shopper/db-pg";
import { createPaystack } from "@shopper/core/payments/paystack";
import type { Envelope } from "@shopper/ports";
import { momoFixture } from "../../support/payments/momo";

let f: Awaited<ReturnType<typeof momoFixture>>;
beforeAll(async () => {
  f = await momoFixture();
});
afterAll(async () => f?.close());

async function start() {
  const response = await f.call("/payments/momo", "POST", {
    amount: 10_000,
    phone: "0241234567",
    network: "mtn",
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { reference: string }).reference;
}
async function expectTerminal(reference: string, status: string) {
  await vi.waitFor(
    async () => {
      const response = await f.call(`/payments/momo/${reference}`);
      expect(await response.json()).toMatchObject({ status });
      const [run] = await f.db
        .select()
        .from(workflowRun)
        .where(eq(workflowRun.instanceId, reference));
      expect(run).toMatchObject({ status: "failed", currentStep: "interrupted" });
    },
    { timeout: 6000, interval: 25 },
  );
}
const unavailable = () =>
  createPaystack({ secretKey: f.fake.secretKey, baseUrl: `${f.fake.baseUrl}/unavailable` });

test("exhausted charge errors expire uncertain money, notify the till and allow late confirmation", async () => {
  const messages: Envelope[] = [];
  const subscription = await f.realtime.subscribe(
    f.orgId,
    f.ids.store,
    v7(),
    "0",
    async (message) => {
      messages.push(message);
    },
  );
  const provider = f.deps.paystack;
  try {
    f.deps.paystack = unavailable();
    const reference = await start();
    await expectTerminal(reference, "expired");
    expect(await (await f.call(`/payments/momo/${reference}`)).json()).toMatchObject({
      failureReason: expect.stringContaining("uncertain"),
    });
    await vi.waitFor(() =>
      expect(messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "payment.updated",
            payload: expect.objectContaining({ reference, status: "expired" }),
          }),
        ]),
      ),
    );
    expect((await f.webhook(reference)).status).toBe(200);
    expect(await (await f.call(`/payments/momo/${reference}`)).json()).toMatchObject({
      status: "confirmed",
    });
  } finally {
    f.deps.paystack = provider;
    await subscription.close();
  }
});

test("a verification exception expires a pending payment instead of leaving it waiting", async () => {
  const provider = f.deps.paystack;
  try {
    const reference = await start();
    await vi.waitFor(() =>
      expect(
        f.fake.requests.some(
          (request) =>
            request.path === "/charge" &&
            (request.body as { reference: string }).reference === reference,
        ),
      ).toBe(true),
    );
    f.deps.paystack = unavailable();
    await expectTerminal(reference, "expired");
  } finally {
    f.deps.paystack = provider;
  }
});

test("an exhausted provider error cannot downgrade a racing successful webhook", async () => {
  const provider = f.deps.paystack;
  try {
    f.deps.paystack = unavailable();
    const reference = await start();
    await vi.waitFor(() =>
      expect(
        f.fake.requests.some(
          (request) =>
            request.path === "/unavailable/charge" &&
            (request.body as { reference: string }).reference === reference,
        ),
      ).toBe(true),
    );
    expect((await f.webhook(reference)).status).toBe(200);
    await expectTerminal(reference, "confirmed");
  } finally {
    f.deps.paystack = provider;
  }
});
