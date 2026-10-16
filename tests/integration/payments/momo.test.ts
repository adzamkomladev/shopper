import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";
import { eq, and, asc } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { verifyChain } from "@shopper/audit";
import { momoFixture } from "../../support/payments/momo";

let f: Awaited<ReturnType<typeof momoFixture>>;
beforeAll(async () => {
  f = await momoFixture();
});
afterAll(async () => f?.close());
const input = (phone = "0551234987") => ({ amount: 10_000, phone, network: "mtn" });
async function start(phone?: string) {
  const reply = await f.call("/payments/momo", "POST", input(phone));
  expect(reply.status).toBe(201);
  return (await reply.json()) as { reference: string };
}
async function state(reference: string, status: string) {
  await vi.waitFor(
    async () => {
      const reply = await f.call(`/payments/momo/${reference}`);
      expect(await reply.json()).toMatchObject({ status });
    },
    { timeout: 5000, interval: 20 },
  );
}

test("a MoMo intent requires an authenticated cashier and device", async () => {
  expect(
    (await f.api.request("/payments/momo", { method: "POST", body: JSON.stringify(input()) }))
      .status,
  ).toBe(401);
});
test("a signed-in cashier can charge whole pesewas and receives a masked phone", async () => {
  const { reference } = await start();
  await state(reference, "confirmed");
  const [row] = await f.db
    .select()
    .from(schema.payment)
    .where(eq(schema.payment.reference, reference));
  expect(row).toMatchObject({ phone: "******4987", amount: 10_000, status: "confirmed" });
  const [run] = await f.db
    .select()
    .from(schema.workflowRun)
    .where(eq(schema.workflowRun.instanceId, reference));
  expect(run).toMatchObject({ businessKey: reference, status: "completed", type: "momo-payment" });
});
test("fractional pesewas fail before a charge is sent", async () => {
  const before = f.fake.requests.length;
  expect((await f.call("/payments/momo", "POST", { ...input(), amount: 10_001 })).status).toBe(400);
  expect(f.fake.requests).toHaveLength(before);
});
test("a wrong OTP remains retryable, and a correct OTP confirms", async () => {
  const { reference } = await start("0551234986");
  await state(reference, "otp");
  expect((await f.call(`/payments/momo/${reference}/otp`, "POST", { otp: "000000" })).status).toBe(
    200,
  );
  await vi.waitFor(() =>
    expect(f.fake.requests.filter((r) => r.path === "/charge/submit_otp").length).toBeGreaterThan(
      0,
    ),
  );
  await state(reference, "otp");
  expect((await f.call(`/payments/momo/${reference}/otp`, "POST", { otp: "123456" })).status).toBe(
    200,
  );
  await state(reference, "confirmed");
});
test("a declined payment is failed with its provider reason", async () => {
  const { reference } = await start("0551234985");
  await state(reference, "failed");
  expect(await (await f.call(`/payments/momo/${reference}`)).json()).toMatchObject({
    failureReason: expect.stringContaining("Declined"),
  });
});
test("a signed webhook confirms pending money once and rejects a different amount", async () => {
  const { reference } = await start("0241234567");
  await state(reference, "pending");
  await vi.waitFor(() =>
    expect(
      f.fake.requests.some(
        (r) => r.path === "/charge" && (r.body as { reference: string }).reference === reference,
      ),
    ).toBe(true),
  );
  expect((await f.webhook(reference, "charge.success", 101)).status).toBe(400);
  expect((await f.webhook(reference)).status).toBe(200);
  expect((await f.webhook(reference)).status).toBe(200);
  await state(reference, "confirmed");
  expect((await f.webhook(reference, "charge.failed")).status).toBe(200);
  await state(reference, "confirmed");
  const rows = await f.db
    .select()
    .from(schema.auditLog)
    .where(
      and(eq(schema.auditLog.orgId, f.orgId), eq(schema.auditLog.command, "payment.momo.updated")),
    );
  expect(
    rows.filter(
      (r) =>
        (r.payload as { workflow?: { step: string } }).workflow?.step === "webhook-confirmed" &&
        r.payload.reference === reference,
    ),
  ).toHaveLength(1);
});
test("an expired payment verifies once, then late success remains in recovery", async () => {
  const { reference } = await start("0241234567");
  await state(reference, "expired");
  expect(f.fake.requests.filter((r) => r.path === `/transaction/verify/${reference}`)).toHaveLength(
    1,
  );
  expect((await f.webhook(reference)).status).toBe(200);
  await state(reference, "confirmed");
  expect(await (await f.call("/payments/momo?status=unresolved")).json()).toMatchObject({
    payments: expect.arrayContaining([expect.objectContaining({ reference, status: "confirmed" })]),
  });
});
test("an unsigned webhook cannot change payment state", async () => {
  expect((await f.api.request("/webhooks/paystack", { method: "POST", body: "{}" })).status).toBe(
    401,
  );
});
test("all payment state changes retain a valid tenant audit chain", async () => {
  const rows = await f.db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, f.orgId))
    .orderBy(asc(schema.auditLog.chainSeq));
  expect(await verifyChain(rows)).toMatchObject({ valid: true });
});

test("retrying an intent reference never charges twice and changing its amount is refused", async () => {
  const { v7 } = await import("uuid");
  const reference = v7();
  const request = { ...input(), reference };
  expect((await f.call("/payments/momo", "POST", request)).status).toBe(201);
  await state(reference, "confirmed");
  expect((await f.call("/payments/momo", "POST", request)).status).toBe(201);
  expect((await f.call("/payments/momo", "POST", { ...request, amount: 20_000 })).status).toBe(409);
  expect(
    f.fake.requests.filter(
      (r) => r.path === "/charge" && (r.body as { reference: string }).reference === reference,
    ),
  ).toHaveLength(1);
});

test("another tenant cannot reuse a globally reserved payment reference", async () => {
  const { startMomo } = await import("@shopper/core/payments");
  const { provisionOrg, provisioningContext } = await import("../../../tooling/database/seed");
  const { reference } = await start();
  const other = provisioningContext();
  await provisionOrg(f.db, other, { name: "Another payment tenant" });
  await expect(
    startMomo(
      f.db,
      {
        orgId: other.orgId,
        actorId: f.ids.user,
        deviceId: f.ids.device,
        branchId: f.ids.branch,
        appVersion: "test",
      },
      { ...input(), reference },
    ),
  ).rejects.toMatchObject({ status: 409 });
});

test("concurrent late provider responses cannot overwrite confirmed money", async () => {
  const { updateMomo, momoCheckpoint } = await import("@shopper/core/payments");
  const { reference } = await start("0241234567");
  await vi.waitFor(() =>
    expect(
      f.fake.requests.some(
        (r) => r.path === "/charge" && (r.body as { reference: string }).reference === reference,
      ),
    ).toBe(true),
  );
  await Promise.all([
    f.webhook(reference),
    updateMomo(
      f.db,
      { orgId: f.orgId, appVersion: "test" },
      { reference, status: "pending" },
      momoCheckpoint(reference, "late-provider", "waiting"),
    ),
  ]);
  await state(reference, "confirmed");
  await vi.waitFor(async () => {
    const [run] = await f.db
      .select()
      .from(schema.workflowRun)
      .where(eq(schema.workflowRun.instanceId, reference));
    expect(run!.status).toBe("completed");
  });
});

test("a failed engine launch retains the intent and the same reference retries safely", async () => {
  const { v7 } = await import("uuid");
  const reference = v7();
  let launches = 0;
  const api = f.withLauncher({
    async start(id, params) {
      if (++launches === 1) throw new Error("Workflow transport unavailable");
      await f.launcher.start(id, params);
    },
    send: (id, type, payload) => f.launcher.send(id, type, payload),
  });
  const call = () =>
    api.request("/payments/momo", {
      method: "POST",
      headers: f.headers,
      body: JSON.stringify({ ...input(), reference }),
    });
  expect((await call()).status).toBe(503);
  expect(await (await f.call(`/payments/momo/${reference}`)).json()).toMatchObject({
    reference,
    status: "pending",
  });
  expect(
    f.fake.requests.filter(
      (r) => r.path === "/charge" && (r.body as { reference: string }).reference === reference,
    ),
  ).toHaveLength(0);
  expect((await call()).status).toBe(201);
  await state(reference, "confirmed");
  expect(
    f.fake.requests.filter(
      (r) => r.path === "/charge" && (r.body as { reference: string }).reference === reference,
    ),
  ).toHaveLength(1);
});
