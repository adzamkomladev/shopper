import { afterEach, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { hostSession } from "@shopper/db-sqlite";
import { shift as serverShift } from "@shopper/db-pg";
import { createPushWorker, createShiftUploadWorker } from "@shopper/sync";
import {
  api,
  appVersion,
  context,
  databases,
  deviceId,
  deviceToken,
  resetLocalTill,
  syncProtocol,
} from "../../../support/till/server";
import { startUpstream } from "../../../support/till/upstream";
import { createPushFixture, type PushFixture } from "../../../support/till/push";
import { shiftRows } from "../../../support/till/shifts";
import {
  closeFixtureShift,
  declareFixtureShift,
  freshShift,
  shiftRow,
} from "../../../support/sync/shifts";

let fixture: PushFixture | undefined;
let worker: ReturnType<typeof createShiftUploadWorker> | undefined;
afterEach(async () => {
  await worker?.stop();
  await fixture?.close();
  fixture = worker = undefined;
});

const posts = () => fixture!.upstream.requests.filter((r) => r.path === "/sync/shifts");

test("a closed shift uploads only after the sale backlog is acknowledged and is marked accepted", async () => {
  fixture = await createPushFixture();
  await freshShift();
  await fixture.recordSale();
  const z = await closeFixtureShift();
  worker = createShiftUploadWorker(fixture.workerOptions);

  await worker.trigger();
  expect(posts()).toHaveLength(0);
  expect((await shiftRow(z.shiftId)).acceptedAt).toBeNull();

  const push = createPushWorker(fixture.workerOptions);
  fixture.worker = push;
  await push.trigger();
  await worker.trigger();
  expect(posts()).toHaveLength(1);
  const row = await shiftRow(z.shiftId);
  expect(posts()[0]!.body).toMatchObject({
    requestId: z.shiftId,
    proof: expect.any(String),
    shift: {
      v: 1,
      type: "shift.closed",
      shift: { orgId: context.orgId, sessionId: row.closedSessionId, report: z },
    },
  });
  expect(row).toMatchObject({
    status: "closed",
    acceptedAt: expect.any(String),
    blockedCode: null,
    result: { id: z.shiftId, closedAt: z.closedAt },
  });
  const [stored] = await databases()
    .db.select()
    .from(serverShift)
    .where(eq(serverShift.id, z.shiftId));
  expect(stored).toMatchObject({ expectedCash: z.cash.expected, anchorHash: z.anchor.hash });

  await worker.trigger(true);
  expect(posts()).toHaveLength(1);
});

test("an open or a declared shift never uploads", async () => {
  fixture = await createPushFixture();
  worker = createShiftUploadWorker(fixture.workerOptions);
  await worker.trigger(true);
  await declareFixtureShift();
  await worker.trigger(true);
  expect(posts()).toHaveLength(0);
  expect(await shiftRows(fixture.database)).toMatchObject([
    { status: "declared", acceptedAt: null },
  ]);
});

test("a rejection is terminal: the code is kept and the shift is never sent again", async () => {
  fixture = await createPushFixture();
  await freshShift();
  const z = await closeFixtureShift();
  const { closedSessionId } = await shiftRow(z.shiftId);
  await fixture.database.transaction((tx) =>
    tx
      .update(hostSession)
      .set({ proof: "forged-proof" })
      .where(eq(hostSession.id, closedSessionId!)),
  );
  worker = createShiftUploadWorker(fixture.workerOptions);
  await worker.trigger();
  expect(posts()).toHaveLength(1);
  expect(await shiftRow(z.shiftId)).toMatchObject({
    blockedCode: "INVALID_SESSION",
    blockedReason: expect.any(String),
    acceptedAt: null,
    nextAttemptAt: null,
  });
  await worker.trigger(true);
  await worker.trigger(true);
  expect(posts()).toHaveLength(1);
});

test("a 503 backs off, the next run waits for the deadline and Sync now sends it", async () => {
  await resetLocalTill();
  await freshShift();
  let down = true;
  const upstream = await startUpstream(async (request) =>
    down && new URL(request.url).pathname === "/sync/shifts"
      ? new Response(null, { status: 503 })
      : api.request(new URL(request.url).pathname, {
          method: request.method,
          headers: request.headers,
          body: await request.arrayBuffer(),
        }),
  );
  try {
    const options = {
      database: databases().local,
      config: {
        orgId: context.orgId,
        deviceId,
        appVersion,
        protocol: syncProtocol,
        upstream: upstream.url,
        deviceToken,
      },
      now: () => 1_800_000_000_000,
      random: () => 0,
    };
    const z = await closeFixtureShift();
    worker = createShiftUploadWorker(options);
    await worker.trigger();
    expect(await shiftRow(z.shiftId)).toMatchObject({
      attempts: 1,
      acceptedAt: null,
      blockedCode: null,
    });
    expect((await shiftRow(z.shiftId)).nextAttemptAt).toBeGreaterThan(options.now());

    down = false;
    await worker.trigger();
    expect(upstream.requests.filter((r) => r.path === "/sync/shifts")).toHaveLength(1);
    await worker.trigger(true);
    expect(upstream.requests.filter((r) => r.path === "/sync/shifts")).toHaveLength(2);
    expect((await shiftRow(z.shiftId)).acceptedAt).not.toBeNull();
  } finally {
    await worker?.stop();
    worker = undefined;
    await upstream.close();
  }
});
