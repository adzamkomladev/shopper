import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { WebSocketServer, type WebSocket } from "ws";
import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { bridgeRequest, type BridgeMessage, type BridgeRequest } from "@shopper/sync/bridge";

type Dispatch = (request: BridgeRequest, trusted: boolean) => Promise<BridgeMessage>;
export async function openHostTransport(options: {
  port: number;
  origins: string[];
  capability: string;
  protocol: number;
  dispatch: Dispatch;
}) {
  const app = new Hono();
  app.get("/health", (c) => c.json({ status: "ok" }));
  const server = serve({ fetch: app.fetch, port: options.port, hostname: "127.0.0.1" });
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const authorizedSockets = new Set<WebSocket>();
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 65536 });
  server.on("upgrade", (request, socket, head) => {
    if (
      request.url !== "/bridge" ||
      !request.headers.origin ||
      !options.origins.includes(request.headers.origin)
    ) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    sockets.handleUpgrade(request, socket, head, (client) =>
      sockets.emit("connection", client, request),
    );
  });
  sockets.on("connection", (socket) => {
    let authorized = false;
    socket.on("error", () => socket.terminate());
    const timer = setTimeout(() => socket.close(1008, "Connect to the register again"), 5000);
    socket.on("close", () => {
      clearTimeout(timer);
      authorizedSockets.delete(socket);
    });
    socket.on("message", async (raw) => {
      let value: unknown;
      try {
        value = JSON.parse(
          (Buffer.isBuffer(raw)
            ? raw
            : raw instanceof ArrayBuffer
              ? Buffer.from(raw)
              : Buffer.concat(raw)
          ).toString("utf8"),
        );
      } catch {
        socket.send(
          JSON.stringify(error(undefined, "INVALID_MESSAGE", "Invalid register request")),
        );
        return;
      }
      const parsed = v.safeParse(bridgeRequest, value);
      if (!parsed.success) {
        socket.send(JSON.stringify(error(value, "INVALID_MESSAGE", "Invalid register request")));
        return;
      }
      const request = parsed.output;
      if (!authorized) {
        if (request.type !== "hello" || request.capability !== options.capability) {
          socket.send(
            JSON.stringify(error(request, "UNAUTHORIZED", "Connect to the register again")),
          );
          return;
        }
        if (request.protocol !== options.protocol) {
          socket.send(
            JSON.stringify(
              error(request, "INCOMPATIBLE_PROTOCOL", "Update Shopper before connecting"),
            ),
          );
          return;
        }
        authorized = true;
        authorizedSockets.add(socket);
        clearTimeout(timer);
      }
      if (!["hello", "status", "retry"].includes(request.type)) {
        socket.send(
          JSON.stringify(
            error(request, "FORBIDDEN", "This action requires the private till connection"),
          ),
        );
        return;
      }
      const result = await options.dispatch(request, false);
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(result));
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing host address");
  return {
    port: address.port,
    broadcast(message: BridgeMessage) {
      for (const socket of authorizedSockets)
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
    },
    async close() {
      for (const socket of sockets.clients) socket.terminate();
      sockets.close();
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
    },
  };
}
export function error(value: unknown, code: string, message: string): BridgeMessage {
  const parsed = v.safeParse(bridgeRequest, value);
  const id = parsed.success
    ? parsed.output.id
    : typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"
      ? v.safeParse(uuidV7Schema, value.id).success
        ? value.id
        : undefined
      : undefined;
  return { type: "error", ...(id ? { id } : {}), code, message };
}
