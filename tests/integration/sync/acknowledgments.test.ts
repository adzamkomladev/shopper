import { afterEach, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { outbox, localSale, tillAudit } from "@shopper/db-sqlite";
import { verifyChain, type AuditEntry } from "@shopper/audit";
import { createPushWorker } from "@shopper/sync";
import { createPushFixture, type PushFixture } from "../../support/till/push";

let fixture: PushFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

const invalidAck = [
  [
    "overlapping accepted/rejected ID",
    (body: Record<string, unknown>) => ({
      ...body,
      rejected: (body.accepted as Array<{ localId: string }>).map((entry) => ({
        localId: entry.localId,
        code: "INVALID_REFERENCE",
        message: "Refresh data",
      })),
    }),
  ],
  [
    "unknown rejected ID",
    (body: Record<string, unknown>) => ({
      ...body,
      rejected: [
        {
          localId: "019a0000-0000-7000-8000-000000000099",
          code: "INVALID_REFERENCE",
          message: "Refresh data",
        },
      ],
    }),
  ],
  [
    "mismatched request ID",
    (body: Record<string, unknown>) => ({
      ...body,
      requestId: "019a0000-0000-7000-8000-000000000099",
    }),
  ],
  [
    "unknown local ID",
    (body: Record<string, unknown>) => ({
      ...body,
      accepted: [{ localId: "019a0000-0000-7000-8000-000000000099", sequence: "1" }],
    }),
  ],
  [
    "duplicate accepted ID",
    (body: Record<string, unknown>) => ({
      ...body,
      accepted: [...(body.accepted as unknown[]), ...(body.accepted as unknown[])],
    }),
  ],
  [
    "non-positive sequence",
    (body: Record<string, unknown>) => ({
      ...body,
      accepted: (body.accepted as Array<Record<string, unknown>>).map((item) => ({
        ...item,
        sequence: "0",
      })),
    }),
  ],
] as const;

test.each(invalidAck)(
  "a %s acknowledgement leaves every submitted outbox row intact",
  async (_name, mutate) => {
    fixture = await createPushFixture({
      alterResponse: async (response, call) => {
        if (call !== 1) return response;
        const body = (await response.json()) as Record<string, unknown>;
        return Response.json(mutate(body));
      },
    });
    const { event } = await fixture.recordSale();
    const worker = createPushWorker(fixture.workerOptions);
    fixture.worker = worker;
    await worker.trigger();

    expect(
      await fixture.database.read((tx) =>
        tx.select().from(outbox).where(eq(outbox.localId, event.sale.localId)),
      ),
    ).toHaveLength(1);
    expect(
      await fixture.database.read((tx) =>
        tx.select().from(localSale).where(eq(localSale.localId, event.sale.localId)),
      ),
    ).toHaveLength(1);
    expect(worker.getStatus().pendingCount).toBe(1);
  },
);

test("malformed acknowledgements delete nothing", async () => {
  fixture = await createPushFixture({
    alterResponse: async (_response, call) =>
      call === 1 ? new Response("{", { status: 200 }) : _response,
  });
  const { event } = await fixture.recordSale();
  const worker = createPushWorker(fixture.workerOptions);
  fixture.worker = worker;
  await worker.trigger();
  expect(
    await fixture.database.read((tx) =>
      tx.select().from(outbox).where(eq(outbox.localId, event.sale.localId)),
    ),
  ).toHaveLength(1);
});

test.each([
  ["429 with Retry-After", 429, "120"],
  ["server failure", 503, undefined],
] as const)("a %s response retains and audits retry state", async (_name, status, retryAfter) => {
  fixture = await createPushFixture({
    alterResponse: (response, call) => {
      if (call !== 1) return response;
      return Response.json(
        { error: "upstream unavailable" },
        {
          status,
          headers: retryAfter ? { "retry-after": retryAfter } : undefined,
        },
      );
    },
  });
  const { event } = await fixture.recordSale();
  const worker = createPushWorker(fixture.workerOptions);
  fixture.worker = worker;
  await worker.trigger();

  const row = await fixture.database.read(async (tx) =>
    tx.select().from(outbox).where(eq(outbox.localId, event.sale.localId)),
  );
  expect(row).toHaveLength(1);
  const retry = row[0];
  if (!retry) throw new Error("Expected retry state for the queued sale");
  expect(retry.attempts).toBeGreaterThan(0);
  expect(retry.nextAttemptAt).toBeGreaterThan(fixture.now);
  if (retryAfter) expect(retry.nextAttemptAt - fixture.now).toBeGreaterThanOrEqual(120_000);
  expect(
    await fixture.database.read((tx) =>
      tx.select().from(localSale).where(eq(localSale.localId, event.sale.localId)),
    ),
  ).toHaveLength(1);
  expect(await worker.trigger()).toBeUndefined();
  expect(fixture.upstream.requests.filter((request) => request.path === "/sync/push")).toHaveLength(
    1,
  );
  const auditRows = await fixture.database.read((tx) => tx.select().from(tillAudit));
  expect(await verifyChain(auditRows as AuditEntry[])).toMatchObject({ valid: true });

  fixture.advanceTime(86_400_000);
  await worker.trigger();
  expect(
    await fixture.database.read((tx) =>
      tx.select().from(outbox).where(eq(outbox.localId, event.sale.localId)),
    ),
  ).toHaveLength(0);
});

test.each([
  ["minimum jitter", 0, [500, 1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 30_000]],
  ["maximum jitter", 1, [1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000, 60_000]],
] as const)("caps exponential retry delay with %s", async (_name, random, expectedDelays) => {
  fixture = await createPushFixture({
    random: () => random,
    alterResponse: (_response) => Response.json({ error: "temporary" }, { status: 503 }),
  });
  await fixture.recordSale();
  let worker = createPushWorker(fixture.workerOptions);
  fixture.worker = worker;
  for (const expectedDelay of expectedDelays) {
    await worker.trigger();
    await worker.stop();
    const [row] = await fixture.queue();
    if (!row) throw new Error("Expected the sale to remain queued for retry");
    expect(row.nextAttemptAt - fixture.now).toBe(expectedDelay);
    fixture.advanceTime(expectedDelay);
    worker = createPushWorker(fixture.workerOptions);
    fixture.worker = worker;
  }
  expect(fixture.upstream.requests.filter((request) => request.path === "/sync/push")).toHaveLength(
    9,
  );
});

test("an HTTP timeout keeps the sale queued and retries only after backoff", async () => {
  fixture = await createPushFixture({ timeoutMs: 2_000, delayMs: 3_000 });
  const { event } = await fixture.recordSale();
  const worker = createPushWorker(fixture.workerOptions);
  fixture.worker = worker;
  await worker.trigger();
  const queued = await fixture.database.read((tx) =>
    tx.select().from(outbox).where(eq(outbox.localId, event.sale.localId)),
  );
  expect(queued).toHaveLength(1);
  const retry = queued[0];
  if (!retry) throw new Error("Expected timed-out sale to remain queued");
  expect(retry.attempts).toBeGreaterThan(0);
  await worker.trigger();
  expect(fixture.upstream.requests.filter((request) => request.path === "/sync/push")).toHaveLength(
    1,
  );
});

test("permanent sale rejection remains blocked with an actionable error", async () => {
  fixture = await createPushFixture({
    alterResponse: async (response, call) => {
      if (call !== 1) return response;
      const body = (await response.json()) as {
        requestId: string;
        accepted: Array<{ localId: string }>;
        rejected: unknown[];
      };
      const firstAccepted = body.accepted[0];
      if (!firstAccepted) throw new Error("Expected the first server accepted sale");
      const localId = firstAccepted.localId;
      return Response.json({
        requestId: body.requestId,
        accepted: [],
        rejected: [{ localId, code: "INVALID_REFERENCE", message: "Refresh product data" }],
      });
    },
  });
  const { event } = await fixture.recordSale();
  const worker = createPushWorker(fixture.workerOptions);
  fixture.worker = worker;
  await worker.trigger();
  const queued = await fixture.database.read((tx) =>
    tx.select().from(outbox).where(eq(outbox.localId, event.sale.localId)),
  );
  expect(queued).toHaveLength(1);
  expect(queued[0]?.blockedReason).toMatch(/INVALID_REFERENCE.*Refresh product data/);
  expect(worker.getStatus()).toMatchObject({ pendingCount: 0, blockedCount: 1, server: "blocked" });
});
