import { afterEach, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { eq } from "drizzle-orm";
import { stockDocument } from "@shopper/db-sqlite";
import { createPushWorker, createStockUploadWorker } from "@shopper/sync";
import { listStockDocuments, queueStockDocument } from "@shopper/core/till";
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
import { ids } from "../../../support/till/sales";
import { startUpstream } from "../../../support/till/upstream";
import { createPushFixture, type PushFixture } from "../../../support/till/push";
import { inventorySession, stockProduct } from "../../../support/till/stock";

let fixture: PushFixture | undefined;
let stock: ReturnType<typeof createStockUploadWorker> | undefined;
afterEach(async () => {
  await stock?.stop();
  await fixture?.close();
  fixture = stock = undefined;
});

const at = new Date("2025-12-31T22:00:00.000Z");

/** Queues a count on the fixture till under a real inventory session (or a forged proof). */
async function queueCount(productId: string, over: { proof?: string } = {}) {
  const issued = await inventorySession();
  return queueStockDocument(
    databases().local,
    { ...context, deviceId },
    {
      scope: { orgId: context.orgId, deviceId, branchId: ids.branch },
      at,
      session: {
        id: issued.sessionId,
        orgId: context.orgId,
        deviceId,
        branchId: ids.branch,
        userId: issued.userId,
        roleName: "inventory",
        issuedAt: "2025-12-31T16:00:00.000Z",
        expiresAt: "2026-01-01T08:00:00.000Z",
        permissions: ["stock.write"],
        proof: over.proof ?? issued.proof,
      },
      document: {
        kind: "count",
        lines: [{ productId, countedThousandths: 3_000 }],
        countedAt: at.toISOString(),
      },
    },
  );
}

const row = async (id: string) =>
  (
    await databases().local.read((tx) =>
      tx.select().from(stockDocument).where(eq(stockDocument.id, id)),
    )
  )[0]!;
const stockRequests = () => fixture!.upstream.requests.filter((r) => r.path === "/sync/stock");

test("a count queued offline uploads only after the sale backlog is acknowledged", async () => {
  fixture = await createPushFixture();
  const queued = await queueCount(await stockProduct(4_000));
  await fixture.recordSale();
  stock = createStockUploadWorker(fixture.workerOptions);

  await stock.trigger();
  expect(stockRequests()).toHaveLength(0);
  expect((await row(queued.id)).acceptedAt).toBeNull();

  const push = createPushWorker(fixture.workerOptions);
  fixture.worker = push;
  await push.trigger();
  await stock.trigger();
  expect(stockRequests()).toHaveLength(1);
  expect(await row(queued.id)).toMatchObject({
    acceptedAt: expect.any(String),
    result: { id: queued.id, kind: "count" },
  });
  expect(
    await listStockDocuments(databases().local, { orgId: context.orgId, limit: 5 }),
  ).toMatchObject([{ id: queued.id, status: "sent" }]);
});

test("a rejected document is blocked with its reason and listed", async () => {
  fixture = await createPushFixture();
  const queued = await queueCount(v7());
  stock = createStockUploadWorker(fixture.workerOptions);
  await stock.trigger();
  await stock.trigger(true);
  expect(stockRequests()).toHaveLength(1);
  expect(await row(queued.id)).toMatchObject({
    blockedCode: "INVALID_REFERENCE",
    blockedReason: expect.any(String),
    acceptedAt: null,
  });
  expect(
    await listStockDocuments(databases().local, { orgId: context.orgId, limit: 5 }),
  ).toMatchObject([{ id: queued.id, status: "rejected", blockedCode: "INVALID_REFERENCE" }]);
});

test("a proof not issued to the actor on this device is rejected", async () => {
  fixture = await createPushFixture();
  const queued = await queueCount(await stockProduct(4_000), { proof: "forged-proof" });
  stock = createStockUploadWorker(fixture.workerOptions);
  await stock.trigger();
  expect(await row(queued.id)).toMatchObject({ blockedCode: "INVALID_SESSION", acceptedAt: null });
});

test("a 503 backs off and Sync now retries", async () => {
  await resetLocalTill();
  let down = true;
  const upstream = await startUpstream(async (request) =>
    down && new URL(request.url).pathname === "/sync/stock"
      ? new Response(null, { status: 503 })
      : api.request(new URL(request.url).pathname, {
          method: request.method,
          headers: request.headers,
          body: await request.arrayBuffer(),
        }),
  );
  try {
    const workerOptions = {
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
    const queued = await queueCount(await stockProduct(4_000));
    stock = createStockUploadWorker(workerOptions);
    await stock.trigger();
    expect(await row(queued.id)).toMatchObject({
      attempts: 1,
      acceptedAt: null,
      blockedCode: null,
    });
    expect((await row(queued.id)).nextAttemptAt).toBeGreaterThan(workerOptions.now());

    down = false;
    await stock.trigger();
    expect(upstream.requests.filter((r) => r.path === "/sync/stock")).toHaveLength(1);
    await stock.trigger(true);
    expect(upstream.requests.filter((r) => r.path === "/sync/stock")).toHaveLength(2);
    expect((await row(queued.id)).acceptedAt).not.toBeNull();
  } finally {
    await stock?.stop();
    stock = undefined;
    await upstream.close();
  }
});
