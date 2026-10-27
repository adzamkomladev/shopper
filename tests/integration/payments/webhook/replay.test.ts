import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import type { Envelope, Json } from "@shopper/ports";
import { momoFixture } from "../../../support/payments/momo";

let f: Awaited<ReturnType<typeof momoFixture>>;
beforeAll(async () => {
  f = await momoFixture();
});
afterAll(async () => f?.close());

test("a Paystack webhook replayed three times is applied once", async () => {
  const published: Envelope[] = [];
  const sent: Array<{ id: string; payload: Json }> = [];
  const api = f.withLauncher(
    {
      start: (id, params) => f.launcher.start(id, params),
      send: async (id, type, payload) => {
        sent.push({ id, payload });
        await f.launcher.send(id, type, payload);
      },
    },
    { ...f.realtime, publish: async (_org, _store, envelope) => void published.push(envelope) },
  );
  const reply = await api.request("/payments/momo", {
    method: "POST",
    headers: f.headers,
    body: JSON.stringify({ amount: 10_000, phone: "0241234567", network: "mtn" }),
  });
  const { reference } = (await reply.json()) as { reference: string };
  await vi.waitFor(() =>
    expect(
      f.fake.requests.some(
        (r) => r.path === "/charge" && (r.body as { reference: string }).reference === reference,
      ),
    ).toBe(true),
  );
  for (let attempt = 0; attempt < 3; attempt++)
    expect((await f.webhookTo(api, reference)).status).toBe(200);

  const events = await f.db
    .select()
    .from(schema.paymentEvent)
    .where(
      and(eq(schema.paymentEvent.orgId, f.orgId), eq(schema.paymentEvent.reference, reference)),
    );
  expect(events).toMatchObject([{ provider: "paystack", kind: "charge.success" }]);
  const applied = await f.db
    .select()
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.orgId, f.orgId),
        eq(schema.auditLog.command, "payment.webhook.applied"),
      ),
    );
  expect(applied.filter((row) => row.payload.reference === reference)).toHaveLength(1);
  expect(published.filter((envelope) => envelope.type === "payment.updated")).toHaveLength(1);
  expect(sent.filter((entry) => entry.id === reference)).toHaveLength(1);
  const [row] = await f.db
    .select()
    .from(schema.payment)
    .where(eq(schema.payment.reference, reference));
  expect(row!.status).toBe("confirmed");
});

test("a failure and a later success for one charge are two events, and success stands", async () => {
  const reply = await f.call("/payments/momo", "POST", {
    amount: 10_000,
    phone: "0241234567",
    network: "mtn",
  });
  const { reference } = (await reply.json()) as { reference: string };
  await vi.waitFor(() =>
    expect(
      f.fake.requests.some(
        (r) => r.path === "/charge" && (r.body as { reference: string }).reference === reference,
      ),
    ).toBe(true),
  );
  expect((await f.webhook(reference, "charge.failed")).status).toBe(200);
  expect((await f.webhook(reference, "charge.success")).status).toBe(200);
  expect((await f.webhook(reference, "charge.failed")).status).toBe(200);
  const events = await f.db
    .select()
    .from(schema.paymentEvent)
    .where(eq(schema.paymentEvent.reference, reference));
  expect(events.map((event) => event.kind).sort()).toEqual(["charge.failed", "charge.success"]);
  const [row] = await f.db
    .select()
    .from(schema.payment)
    .where(eq(schema.payment.reference, reference));
  expect(row!.status).toBe("confirmed");
});
