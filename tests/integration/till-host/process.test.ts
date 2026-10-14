import { afterEach, describe, expect, it } from "vite-plus/test";
import { v7 } from "uuid";
import WebSocket from "ws";
import { reference } from "@shopper/db-sqlite";
import { createHostFixture } from "../../support/till/host/fixture";

let fixture: Awaited<ReturnType<typeof createHostFixture>> | undefined;
afterEach(async () => fixture?.close());

describe("till host process bridge", () => {
  it("records only trusted IPC sales and keeps credentials out of public messages", async () => {
    fixture = await createHostFixture({ freshSession: true });
    const host = await fixture.start();
    const result = await host.request({
      type: "recordSale",
      input: {
        lines: [
          { productId: fixture.config.references.products[0].id, quantityThousandths: 1_500 },
        ],
      },
    });
    expect(result).toMatchObject({ type: "result", kind: "sale" });
    const event = result.event as Record<string, unknown>;
    expect(event).toMatchObject({ v: 2, type: "sale.recorded" });
    expect(await fixture.localSales()).toHaveLength(1);
    expect(await fixture.queued()).toHaveLength(1);

    const status = await host.request({ id: v7(), type: "status" });
    expect(status).toMatchObject({ type: "result", kind: "status" });
    expect(status.status).toMatchObject({
      identity: {
        orgId: fixture.config.identity.orgId,
        deviceId: fixture.config.identity.deviceId,
        storeId: fixture.config.identity.storeId,
        branchId: fixture.config.identity.branchId,
      },
      pendingCount: 1,
    });

    const ws = await openSocket(host.ready.port, "http://127.0.0.1:5184");
    const helloId = v7();
    ws.send(
      JSON.stringify({
        id: helloId,
        type: "hello",
        capability: host.ready.capability,
        appVersion: host.ready.appVersion,
        protocol: host.ready.protocol,
      }),
    );
    const hello = await readSocket(ws);
    expect(hello).toMatchObject({ id: helloId, type: "result", kind: "status" });

    const saleId = v7();
    ws.send(
      JSON.stringify({
        id: saleId,
        type: "recordSale",
        input: {
          lines: [
            { productId: fixture.config.references.products[0].id, quantityThousandths: 1500 },
          ],
        },
      }),
    );
    expect(await readSocket(ws)).toMatchObject({ id: saleId, type: "error", code: "FORBIDDEN" });
    expect(await fixture.localSales()).toHaveLength(1);
    ws.send("{");
    expect(await readSocket(ws)).toMatchObject({ type: "error" });
    expect(JSON.stringify([host.ready, result, status, hello, host.output])).not.toContain(
      fixture.config.deviceToken,
    );
    expect(JSON.stringify([host.ready, result, status, hello, host.output])).not.toContain(
      fixture.config.session?.proof,
    );
    ws.close();
  });

  it("rejects invalid startup references without committing reference writes", async () => {
    fixture = await createHostFixture({ freshSession: true });
    const invalid = {
      ...fixture.config,
      references: {
        ...fixture.config.references,
        products: fixture.config.references.products.map((product) => ({
          ...product,
          orgId: "019a0000-0000-7000-8000-000000000002",
        })),
      },
    };
    await expect(fixture.start(invalid)).rejects.toThrow("Host exited before ready");
    expect(await fixture.database.read((tx) => tx.select().from(reference))).toHaveLength(0);
    expect(await fixture.localSales()).toHaveLength(0);
    expect(await fixture.queued()).toHaveLength(0);
  });

  it("returns a safe correlated error for malformed IPC and remains available", async () => {
    fixture = await createHostFixture();
    const host = await fixture.start();
    const invalidId = v7();
    const invalid = await host.request({ id: invalidId, type: "not-a-command" });
    expect(invalid).toMatchObject({ id: invalidId, type: "error" });
    expect(JSON.stringify(invalid)).not.toContain(fixture.config.deviceToken);
    expect((await host.request({ type: "status" })).type).toBe("result");
  });
});

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
