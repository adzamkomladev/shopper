import type { BoxWebSocketServer } from "./types";
export type { BoxWebSocketServer } from "./types";
import { Hono } from "hono";
import type { Realtime } from "@shopper/ports";

export function boxLive(realtime: Realtime, server: BoxWebSocketServer | undefined) {
  return async (
    request: Request,
    principal: { orgId: string; storeId: string; deviceId: string },
    cursor: string,
  ) => {
    const { upgradeWebSocket } = await import("hono/bun");
    let subscription: Awaited<ReturnType<Realtime["subscribe"]>> | undefined;
    let closed = false;
    const app = new Hono().get(
      "/sync/live",
      upgradeWebSocket(() => ({
        async onOpen(_event, socket) {
          try {
            subscription = await realtime.subscribe(
              principal.orgId,
              principal.storeId,
              principal.deviceId,
              cursor,
              async (message) =>
                socket.send(JSON.stringify({ type: "store.changed", sequence: message.sequence })),
            );
            if (closed) await subscription.close();
          } catch {
            socket.close(1011, "Realtime unavailable");
          }
        },
        async onClose() {
          closed = true;
          await subscription?.close();
        },
        async onError() {
          closed = true;
          await subscription?.close();
        },
      })),
    );
    return app.fetch(request, server);
  };
}
