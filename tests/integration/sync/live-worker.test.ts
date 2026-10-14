import type { Duplex } from "node:stream";
import { createServer } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { WebSocket, WebSocketServer } from "ws";
import { expect, test, vi } from "vite-plus/test";
import { createLiveWorker } from "@shopper/sync";

async function fixture(accept = true) {
  const server = createServer();
  const wss = new WebSocketServer({ noServer: true });
  const clients: WebSocket[] = [];
  const peers: WebSocket[] = [];
  const upgrades = new Set<Duplex>();
  const connections = new Set<Duplex>();
  let closing = false;
  server.on("connection", (socket) => {
    if (closing) return socket.destroy();
    connections.add(socket);
    socket.once("close", () => connections.delete(socket));
  });
  let pulls = 0;
  let failure = false;
  server.on("upgrade", (request, socket, bytes) => {
    upgrades.add(socket);
    expect(request.url).toBe("/sync/live?cursor=17");
    expect(request.headers.authorization).toBe("Bearer secret");
    expect(request.headers["x-shopper-device"]).toBe("device");
    if (accept) wss.handleUpgrade(request, socket, bytes, (peer) => peers.push(peer));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const worker = createLiveWorker({
    config: {
      upstream: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      deviceId: "device",
      deviceToken: "secret",
    },
    cursor: () => "17",
    trigger: async () => {
      pulls++;
      if (failure) throw new Error("Pull unavailable");
    },
    connect(url, headers) {
      const client = new WebSocket(url, { headers });
      clients.push(client);
      return client;
    },
  });
  return {
    worker,
    server,
    clients,
    peers,
    pulls: () => pulls,
    fail(value: boolean) {
      failure = value;
    },
    async close() {
      closing = true;
      await worker.stop();
      for (const client of clients) client.terminate();
      for (const peer of peers) peer.terminate();
      for (const upgrade of upgrades) upgrade.destroy();
      for (const connection of connections) connection.destroy();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

test("real socket nudges pull, termination polls at thirty seconds and reconnection pulls again", async () => {
  const f = await fixture();
  try {
    f.worker.start();
    await once(f.clients[0]!, "open");
    expect(f.pulls()).toBe(1);
    const message = once(f.clients[0]!, "message");
    f.peers[0]!.send(JSON.stringify({ type: "store.changed", sequence: "18" }));
    await message;
    expect(f.pulls()).toBe(2);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const closed = once(f.clients[0]!, "close");
    f.peers[0]!.terminate();
    await closed;
    expect(f.worker.getMode()).toBe("polling");
    await vi.advanceTimersByTimeAsync(29_999);
    expect(f.pulls()).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.pulls()).toBe(3);
    await once(f.clients[1]!, "open");
    expect(f.pulls()).toBe(4);
    expect(f.worker.getMode()).toBe("live");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(f.clients).toHaveLength(2);
    expect(f.worker.getMode()).toBe("live");
  } finally {
    vi.useRealTimers();
    await f.close();
  }
});

test("a real upgrade that never completes still polls first at thirty seconds", async () => {
  const f = await fixture(false);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    const upgrading = once(f.server, "upgrade");
    f.worker.start();
    await upgrading;
    await vi.advanceTimersByTimeAsync(29_999);
    expect(f.pulls()).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.pulls()).toBe(1);
  } finally {
    vi.useRealTimers();
    await f.close();
  }
});

test("a connected socket with a failed pull retries after thirty seconds and recovers", async () => {
  const f = await fixture();
  try {
    f.worker.start();
    await once(f.clients[0]!, "open");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    f.fail(true);
    const message = once(f.clients[0]!, "message");
    f.peers[0]!.send(JSON.stringify({ type: "store.changed", sequence: "18" }));
    await message;
    expect(f.worker.getMode()).toBe("offline");
    await vi.advanceTimersByTimeAsync(29_999);
    expect(f.pulls()).toBe(2);
    f.fail(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.pulls()).toBe(3);
    await once(f.clients[1]!, "open");
    expect(f.pulls()).toBe(4);
    expect(f.worker.getMode()).toBe("live");
  } finally {
    vi.useRealTimers();
    await f.close();
  }
});

test("a healthy idle socket catches up within five minutes even when no nudge arrives", async () => {
  const f = await fixture();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    f.worker.start();
    await once(f.clients[0]!, "open");
    expect(f.pulls()).toBe(1);
    await vi.advanceTimersByTimeAsync(299_999);
    expect(f.pulls()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.pulls()).toBe(2);
    expect(f.worker.getMode()).toBe("live");
    expect(f.clients).toHaveLength(1);
    await f.worker.stop();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(f.pulls()).toBe(2);
  } finally {
    vi.useRealTimers();
    await f.close();
  }
});
