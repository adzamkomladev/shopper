import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { WebSocketServer, type WebSocket } from "ws";
import * as v from "valibot";
import { loopbackGuard } from "./http/guard";
import { serveTillUi } from "./http/static";
import { uuidV7Schema } from "@shopper/ports";
import {
  approvalRequestTypes,
  customerRequestTypes,
  refundRequestTypes,
  shiftRequestTypes,
  basketRequestTypes,
  bridgeRequest,
  deviceRequestTypes,
  sessionRequestTypes,
  type BridgeMessage,
  type BridgeRequest,
} from "@shopper/sync/bridge";

type Dispatch = (request: BridgeRequest, trusted: boolean) => Promise<BridgeMessage>;
// What the capability holder may ask; recordSale and shutdown stay on the trusted IPC channel.
const browserRequests: readonly string[] = [
  "hello",
  "status",
  "retry",
  "sales.list",
  "sales.read",
  ...basketRequestTypes,
  ...deviceRequestTypes,
  ...sessionRequestTypes,
  ...approvalRequestTypes,
  ...refundRequestTypes,
  ...shiftRequestTypes,
  ...customerRequestTypes,
];
export async function openHostTransport(options: {
  port: number;
  origins: string[];
  ui?: string;
  capability: string;
  protocol: number;
  dispatch: Dispatch;
  /** Mounts the desktop and back-office routes ahead of the static UI. */
  mount?: (app: Hono, port: () => number) => void;
}) {
  const app = new Hono();
  let port = options.port;
  app.use(loopbackGuard(() => port));
  app.get("/health", (c) => c.json({ status: "ok" }));
  options.mount?.(app, () => port);
  if (options.ui) app.get("*", serveTillUi(options.ui));
  const server = serve({ fetch: app.fetch, port: options.port, hostname: "127.0.0.1" });
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing host address");
  port = address.port;
  // The host's own origin is allowed to open the bridge when it serves the UI itself.
  const origins = options.ui ? [...options.origins, `http://127.0.0.1:${port}`] : options.origins;
  const authorizedSockets = new Set<WebSocket>();
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 65536 });
  server.on("upgrade", (request, socket, head) => {
    if (
      request.url !== "/bridge" ||
      !request.headers.origin ||
      !origins.includes(request.headers.origin)
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
      if (!browserRequests.includes(request.type)) {
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
  return {
    port,
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
