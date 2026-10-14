import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { createSyncRoutes } from "@shopper/api/sync";
import { setPrice } from "@shopper/core/catalogue";
import { boxRealtime } from "@shopper/adapters-box";
import { databases, devices, sequencer, context, deviceId } from "../../support/till/server";
import { syncHeaders } from "../../support/till/requests";
import { ids } from "../../support/till/sales";
import { storeId } from "../../support/till/pull";

test("live authenticates the header device and forwards only its trusted scope", async () => {
  const scopes: unknown[] = [];
  const app = createSyncRoutes({
    database: databases().db,
    devices,
    sequencer,
    live: async (_request, principal, cursor) => {
      scopes.push({ ...principal, cursor });
      return new Response(null, { status: 204 });
    },
  });
  const connect = (headers: Record<string, string>, query = "cursor=0") =>
    app.request(`/sync/live?${query}`, { headers: { ...headers, Upgrade: "websocket" } });
  expect((await connect({})).status).toBe(401);
  expect((await connect({ ...syncHeaders(), "X-Shopper-Device": v7() })).status).toBe(401);
  expect((await connect(syncHeaders(), `cursor=0&device=${v7()}&store=${v7()}`)).status).toBe(204);
  expect(scopes).toEqual([
    expect.objectContaining({ orgId: ids.org, storeId, deviceId, cursor: "0" }),
  ]);
  expect((await connect(syncHeaders(), "cursor=oops")).status).toBe(400);
});

test("a committed price emits a payload-free store nudge in under one second", async () => {
  const hub = boxRealtime();
  const messages: unknown[] = [];
  const connection = await hub.subscribe(ids.org, storeId, v7(), "0", async (message) => {
    messages.push(message);
  });
  const started = performance.now();
  try {
    await setPrice(
      databases().db,
      {
        ...context,
        onStoreChanged: async (store, sequence) => {
          await hub.publish(ids.org, store, {
            id: v7(),
            orgId: ids.org,
            v: 1,
            sequence,
            type: "store.changed",
            payload: { sequence },
          });
        },
      },
      { productId: ids.product, data: { amount: 10000 } },
    );
    await expect.poll(() => messages.length).toBe(1);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(messages[0]).toMatchObject({
      type: "store.changed",
      payload: { sequence: expect.any(String) },
    });
  } finally {
    await connection.close();
  }
});

test("rolling back a feed command emits no nudge", async () => {
  const { defineCommand } = await import("@shopper/audit");
  const { deleted, recordChanges } = await import("@shopper/core/changes");
  const notices: string[] = [];
  const rollback = defineCommand({
    name: "test.realtime.rollback",
    async run(tx, ctx) {
      await recordChanges(tx, ctx.orgId, [deleted("product", v7())], [storeId]);
      throw new Error("Rollback");
    },
    audit: () => ({}),
  });
  await expect(
    rollback(
      databases().db,
      {
        ...context,
        onStoreChanged: async (store) => {
          notices.push(store);
        },
      },
      undefined,
    ),
  ).rejects.toThrow("Rollback");
  expect(notices).toEqual([]);
});
