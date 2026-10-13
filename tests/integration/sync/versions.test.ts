import { readFile } from "node:fs/promises";
import { afterEach, expect, test } from "vite-plus/test";
import { Hono } from "hono";
import * as v from "valibot";
import { createSyncRoutes } from "@shopper/api/sync";
import { createPushWorker } from "@shopper/sync";
import { createEventDecoder, saleEvent } from "@shopper/core/schemas";
import { createPushFixture, type PushFixture } from "../../support/till/push";
import {
  databases,
  devices,
  sequencer,
  deviceId,
  deviceToken,
  appVersion,
} from "../../support/till/server";
import { startUpstream } from "../../support/till/upstream";

let fixture: PushFixture | undefined;
let protocolTwo: Awaited<ReturnType<typeof startUpstream>> | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
  await protocolTwo?.close();
  protocolTwo = undefined;
});

test("protocol 1 negotiates with the deployed protocol 1 route", async () => {
  fixture = await createPushFixture();
  await fixture.recordSale();
  const worker = createPushWorker(fixture.workerOptions);
  fixture.worker = worker;
  await worker.trigger();
  const handshake = fixture.upstream.requests.find((request) => request.path === "/sync/handshake");
  expect(handshake?.response).toMatchObject({ protocol: 1, appVersion });
  expect(worker.getStatus()).toMatchObject({ server: "online", pendingCount: 0 });
});

test("protocol 2 clients are held in incompatible state by a protocol 1 server", async () => {
  fixture = await createPushFixture();
  await fixture.recordSale();
  const worker = createPushWorker({
    ...fixture.workerOptions,
    config: { ...fixture.workerOptions.config, protocol: 2 },
  });
  fixture.worker = worker;
  await worker.trigger();
  expect(worker.getStatus()).toMatchObject({ server: "incompatible", pendingCount: 1 });
  expect(
    fixture.upstream.requests.find((request) => request.path === "/sync/handshake")?.status,
  ).toBe(409);
  expect(fixture.upstream.requests.some((request) => request.path === "/sync/push")).toBe(false);
  expect(await fixture.queue()).toHaveLength(1);
});

test("the checked-in v1 fixture advances one event version and preserves the original app version", async () => {
  const golden = JSON.parse(
    await readFile(new URL("../../fixtures/sales/v1.json", import.meta.url), "utf8"),
  );
  const versionTwo = v.object({
    v: v.literal(2),
    type: v.literal("sale.recorded"),
    sale: saleEvent.entries.sale,
    snapshotFormat: v.literal(2),
  });
  const decode = createEventDecoder(2, (raw) => v.parse(versionTwo, raw), {
    1: (raw) => ({ ...v.parse(saleEvent, raw), v: 2, snapshotFormat: 2 }),
  });
  const badJump = createEventDecoder(3, (raw) => raw, {
    1: (raw) => ({ ...(raw as object), v: 3 }),
  });
  const app = new Hono();
  app.post("/event", async (c) => {
    try {
      return c.json({ event: decode(await c.req.json()) });
    } catch {
      return c.json({ error: "Unsupported event version" }, 400);
    }
  });
  app.post("/bad-jump", async (c) => {
    try {
      return c.json({ event: badJump(await c.req.json()) });
    } catch {
      return c.json({ error: "Unsupported event version" }, 400);
    }
  });
  protocolTwo = await startUpstream((request) => app.fetch(request));
  const decodedResponse = await fetch(`${protocolTwo.url}/event`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(golden),
  });
  expect(decodedResponse.status).toBe(200);
  const decoded = ((await decodedResponse.json()) as { event: v.InferOutput<typeof versionTwo> })
    .event;
  expect(decoded).toMatchObject({ v: 2, snapshotFormat: 2, sale: { appVersion: "0.1.0-test" } });
  expect(decoded.sale.id).toBe(golden.sale.id);
  expect(decoded.sale.totals).toEqual(golden.sale.totals);
  const invalidResponse = await fetch(`${protocolTwo.url}/bad-jump`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(golden),
  });
  expect(invalidResponse.status).toBe(400);
});

test("a protocol 2 server accepts protocol 1 and dispatches the checked-in v1 sale event", async () => {
  fixture = await createPushFixture();
  const recorded = await fixture.recordSale();
  const { db, context } = databases();
  const routes = createSyncRoutes({ database: db, devices, sequencer, protocol: 2 });
  protocolTwo = await startUpstream((request) => routes.fetch(request));
  const golden = JSON.parse(
    await readFile(new URL("../../fixtures/sales/v1.json", import.meta.url), "utf8"),
  ) as typeof recorded.event;
  const event = {
    ...golden,
    sale: {
      ...golden.sale,
      orgId: context.orgId,
      deviceId,
      branchId: recorded.event.sale.branchId,
      cashierId: recorded.event.sale.cashierId,
      sessionId: recorded.sessionId,
    },
  };
  const headers = {
    authorization: `Bearer ${deviceToken}`,
    "X-Shopper-Device": deviceId,
    "X-Shopper-Org": context.orgId,
    "content-type": "application/json",
  };
  const handshake = await fetch(`${protocolTwo.url}/sync/handshake`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      requestId: "019a0000-0000-7000-8000-000000000098",
      protocol: 1,
      appVersion,
    }),
  });
  expect(handshake.status).toBe(200);
  expect(await handshake.json()).toMatchObject({ protocol: 1, appVersion });
  const response = await fetch(`${protocolTwo.url}/sync/push`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      requestId: "019a0000-0000-7000-8000-000000000099",
      protocol: 1,
      events: [event],
      proofs: [{ sessionId: recorded.sessionId, proof: recorded.proof }],
    }),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ accepted: [{ localId: event.sale.localId }] });
  expect(protocolTwo.requests.map((request) => request.path)).toEqual([
    "/sync/handshake",
    "/sync/push",
  ]);
});
