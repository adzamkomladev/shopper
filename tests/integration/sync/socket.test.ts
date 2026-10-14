import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket, WebSocketServer } from "ws";
import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { createSyncRoutes } from "@shopper/api/sync";
import { boxRealtime } from "@shopper/adapters-box";
import { setPrice } from "@shopper/core/catalogue";
import { api, context, databases, devices, sequencer } from "../../support/till/server";
import { syncHeaders } from "../../support/till/requests";
import { head, pull } from "../../support/till/pull";
import { ids } from "../../support/till/sales";

test("a real authenticated socket nudges a till to pull a price in under one second", async () => {
  const hub = boxRealtime();
  const server = createServer();
  const sockets = new WebSocketServer({ noServer: true });
  server.on("upgrade", async (incoming, duplex, bytes) => {
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers))
      if (value) headers.set(name, Array.isArray(value) ? value.join(",") : value);
    const app = createSyncRoutes({
      database: databases().db,
      devices,
      sequencer,
      live: async (_request, principal, cursor) => {
        sockets.handleUpgrade(incoming, duplex, bytes, async (socket) => {
          const subscription = await hub.subscribe(
            principal.orgId,
            principal.storeId,
            principal.deviceId,
            cursor,
            async (message) => socket.send(JSON.stringify(message)),
          );
          socket.once("close", () => void subscription.close());
        });
        return new Response(null, { status: 204 });
      },
    });
    const response = await app.request(incoming.url ?? "/", { headers });
    if (response.status !== 204) {
      duplex.write(`HTTP/1.1 ${response.status} Rejected\r\n\r\n`);
      duplex.destroy();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const cursor = String(await head());
  const socket = new WebSocket(
    `ws://127.0.0.1:${(server.address() as AddressInfo).port}/sync/live?cursor=${cursor}`,
    { headers: syncHeaders() },
  );
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });
    const applied = new Promise<unknown>((resolve, reject) =>
      socket.once("message", async () => {
        try {
          resolve(await (await pull(api, { cursor, bootstrapped: "true" })).json());
        } catch (error) {
          reject(error);
        }
      }),
    );
    const start = performance.now();
    await setPrice(
      databases().db,
      {
        ...context,
        onStoreChanged: async (storeId, sequence) => {
          await hub.publish(ids.org, storeId, {
            id: v7(),
            orgId: ids.org,
            v: 1,
            sequence,
            type: "store.changed",
            payload: { sequence },
          });
        },
      },
      { productId: ids.product, data: { amount: 120000 } },
    );
    expect(await applied).toMatchObject({
      changes: [
        expect.objectContaining({
          entity: "price",
          payload: expect.objectContaining({ amount: 120000 }),
        }),
      ],
    });
    expect(performance.now() - start).toBeLessThan(1000);
  } finally {
    socket.terminate();
    await new Promise<void>((resolve) => sockets.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
