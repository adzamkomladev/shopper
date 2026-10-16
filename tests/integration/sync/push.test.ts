import { afterEach, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { localSale, outbox } from "@shopper/db-sqlite";
import { createPushWorker } from "@shopper/sync";
import { createPushFixture, type PushFixture } from "../../support/till/push";

let fixture: PushFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

test("startup uploads the durable queue through the real route and retains sale snapshots", async () => {
  fixture = await createPushFixture();
  const { event } = await fixture.recordSale();
  const worker = createPushWorker(fixture.workerOptions);
  fixture.worker = worker;
  worker.start();
  await worker.trigger();

  const handshake = fixture.upstream.requests.find((request) => request.path === "/sync/handshake");
  const upload = fixture.upstream.requests.find((request) => request.path === "/sync/push");
  if (!handshake) throw new Error("Expected the startup handshake request");
  if (!upload) throw new Error("Expected the startup push request");
  expect(handshake).toMatchObject({
    body: { protocol: fixture.workerOptions.config.protocol, appVersion: fixture.appVersion },
    response: {
      requestId: (handshake.body as { requestId: string }).requestId,
      protocol: fixture.workerOptions.config.protocol,
      appVersion: fixture.appVersion,
    },
  });
  expect(upload).toMatchObject({
    headers: {
      authorization: `Bearer ${fixture.deviceToken}`,
      "x-shopper-device": fixture.deviceId,
    },
  });
  const body = upload.body as {
    requestId: string;
    events: Array<{ sale: { localId: string } }>;
    proofs: Array<{ sessionId: string; proof: string }>;
  };
  expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(body.events).toEqual([event]);
  expect(body.proofs).toEqual([{ sessionId: fixture.sessionId, proof: fixture.sessionProof }]);
  expect(JSON.stringify(body.events)).not.toContain(fixture.sessionProof);
  expect(upload.response).toMatchObject({
    requestId: body.requestId,
    accepted: [{ localId: event.sale.localId, sequence: expect.any(String) }],
    rejected: [],
  });
  const accepted = (upload.response as { accepted: Array<{ sequence: string }> }).accepted[0];
  if (!accepted) throw new Error("Expected an accepted sale sequence");
  expect(BigInt(accepted.sequence)).toBeGreaterThan(0n);

  const saved = await fixture.database.read(async (tx) => ({
    sales: await tx.select().from(localSale).where(eq(localSale.localId, event.sale.localId)),
    queue: await tx.select().from(outbox).where(eq(outbox.localId, event.sale.localId)),
  }));
  expect(saved.sales).toHaveLength(1);
  expect(saved.sales[0]?.payload).toEqual(event.sale);
  expect(saved.queue).toHaveLength(0);
  expect(worker.getStatus()).toMatchObject({ server: "online", pendingCount: 0, blockedCount: 0 });
});

test("does not upload queued sales after an invalid empty-version handshake", async () => {
  fixture = await createPushFixture({
    alterHandshake: async (response) => {
      const body = (await response.json()) as Record<string, unknown>;
      return Response.json({ ...body, appVersion: "" }, { status: response.status });
    },
  });
  await fixture.recordSale();
  const worker = createPushWorker(fixture.workerOptions);
  fixture.worker = worker;
  await worker.trigger();

  expect(fixture.upstream.requests.map((request) => request.path)).toEqual(["/sync/handshake"]);
  expect(await fixture.queue()).toHaveLength(1);
  expect(await fixture.sales()).toHaveLength(1);
  expect(worker.getStatus()).toMatchObject({ server: "offline", pendingCount: 1, blockedCount: 0 });
});

test("continues eligible batches while preserving permanent rejections", async () => {
  fixture = await createPushFixture({
    alterResponse: async (response, call) => {
      if (call !== 1) return response;
      const body = (await response.json()) as {
        requestId: string;
        accepted: Array<{ localId: string; sequence: string }>;
        rejected: Array<{ localId: string; code: string; message: string }>;
      };
      const rejected = body.accepted[1];
      if (!rejected) throw new Error("Expected the second sale in the first batch");
      const rejectedId = rejected.localId;
      return Response.json({
        ...body,
        accepted: body.accepted.filter((entry) => entry.localId !== rejectedId),
        rejected: [
          { localId: rejectedId, code: "INVALID_REFERENCE", message: "Refresh product data" },
        ],
      });
    },
  });
  const localIds: string[] = [];
  for (let index = 0; index < 201; index += 1)
    localIds.push((await fixture.recordSale()).event.sale.localId);
  const worker = createPushWorker(fixture.workerOptions);
  fixture.worker = worker;
  await worker.trigger();

  const uploads = fixture.upstream.requests.filter((request) => request.path === "/sync/push");
  expect(uploads[0]?.serverResponse).toMatchObject({ rejected: [] });
  expect(uploads.map((request) => (request.body as { events: unknown[] }).events.length)).toEqual([
    200, 1,
  ]);
  const queue = await fixture.database.read((tx) =>
    tx.select().from(outbox).orderBy(outbox.localSeq),
  );
  expect(queue).toHaveLength(1);
  expect(queue[0]?.localId).toBe(localIds[1]);
  expect(queue[0]?.blockedReason).toMatch(/INVALID_REFERENCE.*Refresh product data/);
  expect(await fixture.database.read((tx) => tx.select().from(localSale))).toHaveLength(201);
  expect(worker.getStatus()).toMatchObject({ pendingCount: 0, blockedCount: 1 });
});

test("splits upload batches by encoded request bytes below the event-count limit", async () => {
  fixture = await createPushFixture();
  const localIds: string[] = [];
  const events = [];
  for (let index = 0; index < 40; index += 1) {
    const event = (await fixture.recordSale({ lineCount: 100 })).event;
    events.push(event);
    localIds.push(event.sale.localId);
  }
  expect(
    events.reduce((total, event) => total + Buffer.byteLength(JSON.stringify(event)), 0),
  ).toBeGreaterThan(1_048_576);
  const worker = createPushWorker(fixture.workerOptions);
  fixture.worker = worker;
  await worker.trigger();

  const uploads = fixture.upstream.requests.filter((request) => request.path === "/sync/push");
  expect(uploads[0]?.serverResponse).toMatchObject({ rejected: [] });
  expect(uploads.length).toBeGreaterThan(1);
  expect(uploads.every((request) => request.bytes <= 1_048_576)).toBe(true);
  expect(
    uploads.every((request) => (request.body as { events: unknown[] }).events.length < 200),
  ).toBe(true);
  expect(
    uploads
      .flatMap((request) =>
        (request.body as { events: Array<{ sale: { localId: string } }> }).events.map(
          (event) => event.sale.localId,
        ),
      )
      .sort(),
  ).toEqual(localIds.sort());
  expect(await fixture.queue()).toHaveLength(0);
  expect(await fixture.sales()).toHaveLength(40);
});

test("blocks one event larger than the request limit and uploads later eligible sales", async () => {
  fixture = await createPushFixture();
  const oversized = await fixture.recordSale({ lineCount: 5_000 });
  expect(Buffer.byteLength(JSON.stringify(oversized.event))).toBeGreaterThan(1_048_576);
  const eligible = await fixture.recordSale();
  const worker = createPushWorker(fixture.workerOptions);
  fixture.worker = worker;
  await worker.trigger();

  const uploads = fixture.upstream.requests.filter((request) => request.path === "/sync/push");
  expect(uploads).toHaveLength(1);
  const upload = uploads[0];
  if (!upload) throw new Error("Expected the eligible sale upload");
  expect(upload.bytes).toBeLessThanOrEqual(1_048_576);
  expect(
    (upload.body as { events: Array<{ sale: { localId: string } }> }).events.map(
      (event) => event.sale.localId,
    ),
  ).toEqual([eligible.event.sale.localId]);
  const queue = await fixture.queue();
  expect(queue).toHaveLength(1);
  expect(queue[0]?.localId).toBe(oversized.event.sale.localId);
  expect(queue[0]?.blockedReason).toMatch(/1.?MiB|request.*size|too large/i);
  expect(worker.getStatus()).toMatchObject({ pendingCount: 0, blockedCount: 1 });
  expect(await fixture.sales()).toHaveLength(2);
});

test("parallel triggers share one request, and stopping cancels a scheduled retry", async () => {
  fixture = await createPushFixture({
    alterResponse: (_response, call) =>
      call === 1 ? Response.json({ error: "temporary" }, { status: 503 }) : _response,
  });
  await fixture.recordSale();
  const worker = createPushWorker(fixture.workerOptions);
  fixture.worker = worker;
  await Promise.all([worker.trigger(), worker.trigger(), worker.trigger()]);
  expect(fixture.upstream.requests.filter((request) => request.path === "/sync/push")).toHaveLength(
    1,
  );
  expect(worker.getStatus().pendingCount).toBe(1);
  await worker.stop();
  fixture.advanceTime(86_400_000);
  await worker.trigger();
  expect(fixture.upstream.requests.filter((request) => request.path === "/sync/push")).toHaveLength(
    1,
  );
});
