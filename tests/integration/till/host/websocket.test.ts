import { afterEach, describe, expect, it } from "vite-plus/test";
import { v7 } from "uuid";
import WebSocket from "ws";
import { createHostFixture } from "../../../support/till/host/fixture";

let fixture: Awaited<ReturnType<typeof createHostFixture>> | undefined;
afterEach(async () => fixture?.close());

describe("till host WebSocket bridge", () => {
  it("rejects disallowed Origins and invalid capabilities", async () => {
    fixture = await createHostFixture({ origins: ["https://register.example"] });
    const host = await fixture.start();
    await expect(rejectedSocket(host.ready.port, "https://evil.example")).resolves.toBe(403);

    const socket = await openSocket(host.ready.port, "https://register.example");
    const id = v7();
    socket.send(
      JSON.stringify({
        id,
        type: "hello",
        capability: "wrong-capability",
        appVersion: host.ready.appVersion,
        protocol: host.ready.protocol,
      }),
    );
    expect(await readSocket(socket)).toMatchObject({ id, type: "error" });
    socket.close();
  });

  it("supports reconnects during one host run and rotates its capability after restart", async () => {
    fixture = await createHostFixture({ origins: ["http://127.0.0.1:5184"], session: null });
    const first = await fixture.start();
    const firstCapability = first.ready.capability;
    const socket = await openSocket(first.ready.port, "http://127.0.0.1:5184");
    expect(await hello(socket, first.ready)).toMatchObject({ type: "result", kind: "status" });
    socket.close();

    const reconnect = await openSocket(first.ready.port, "http://127.0.0.1:5184");
    expect(await hello(reconnect, first.ready)).toMatchObject({ type: "result", kind: "status" });
    reconnect.close();
    await first.stop();

    const second = await fixture.start();
    expect(second.ready.capability).not.toBe(firstCapability);
    expect(second.ready.port).toBe(first.ready.port);
    const stale = await openSocket(second.ready.port, "http://127.0.0.1:5184");
    expect(await hello(stale, { ...second.ready, capability: firstCapability })).toMatchObject({
      type: "error",
    });
    stale.close();
  });

  it("closes connected clients and refuses reconnect after the host exits", async () => {
    fixture = await createHostFixture({ session: null });
    const host = await fixture.start();
    const socket = await openSocket(host.ready.port, "http://127.0.0.1:5184");
    expect(await hello(socket, host.ready)).toMatchObject({ type: "result" });
    const closed = new Promise<void>((resolve) => socket.once("close", () => resolve()));
    await host.kill();
    await closed;
    await expect(openSocket(host.ready.port, "http://127.0.0.1:5184")).rejects.toThrow();
  });

  it("reports upstream failure while retaining queued work and exposes a retry action", async () => {
    fixture = await createHostFixture({
      upstream: "http://127.0.0.1:1",
      freshSession: true,
    });
    const host = await fixture.start();
    const sale = await host.request({
      type: "recordSale",
      input: {
        lines: [
          { productId: fixture.config.references.products[0].id, quantityThousandths: 1_500 },
        ],
      },
    });
    expect(sale).toMatchObject({ type: "result", kind: "sale" });
    const retry = await host.request({ type: "retry" });
    expect(retry).toMatchObject({
      type: "result",
      kind: "status",
      status: { server: "offline", pendingCount: 1 },
    });
    expect(await fixture.queued()).toHaveLength(1);
  });
});

async function hello(
  socket: WebSocket,
  ready: { capability: string; appVersion: string; protocol: number },
) {
  const id = v7();
  socket.send(
    JSON.stringify({
      id,
      type: "hello",
      capability: ready.capability,
      appVersion: ready.appVersion,
      protocol: ready.protocol,
    }),
  );
  return readSocket(socket);
}

async function openSocket(port: number, origin: string) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/bridge`, { origin });
  await new Promise<void>((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  return socket;
}

function readSocket(socket: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const receive = (data: import("ws").RawData) => {
      try {
        const bytes = Buffer.isBuffer(data)
          ? data
          : data instanceof ArrayBuffer
            ? Buffer.from(data)
            : Buffer.concat(data);
        const message = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
        if (message.type === "status") return;
        socket.off("message", receive);
        resolve(message);
      } catch (error) {
        socket.off("message", receive);
        reject(error);
      }
    };
    socket.on("message", receive);
    socket.once("error", reject);
  });
}

function rejectedSocket(port: number, origin: string) {
  return new Promise<number>((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/bridge`, { origin });
    socket.once("unexpected-response", (_request, response) => {
      socket.terminate();
      resolve(response.statusCode ?? 0);
    });
    socket.once("open", () => reject(new Error("Disallowed Origin connected")));
    socket.once("error", (error) => {
      if (!socket.listenerCount("unexpected-response")) reject(error);
    });
  });
}
