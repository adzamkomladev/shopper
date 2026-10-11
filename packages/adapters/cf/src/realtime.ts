import * as v from "valibot";
import {
  messageBody,
  scopedKey,
  sequenceSchema,
  uuidV7Schema,
  type Envelope,
  type Realtime,
} from "@shopper/ports";
import type { StoreHub } from "./coordination";

export function cloudflareRealtime(binding: DurableObjectNamespace<StoreHub>): Realtime {
  const hub = (orgId: string, storeId: string) => binding.getByName(scopedKey(orgId, storeId));
  return {
    async publish(orgId, storeId, message) {
      if (message.orgId !== orgId) throw new Error("Message belongs to another organization");
      messageBody(message);
      await hub(orgId, storeId).broadcast(message);
    },
    async subscribe(orgId, storeId, deviceId, cursor, onMessage) {
      v.parse(uuidV7Schema, deviceId);
      v.parse(sequenceSchema, cursor);
      const query = new URLSearchParams({ device: deviceId, cursor });
      const response = await hub(orgId, storeId).fetch(`https://store-hub/?${query}`, {
        headers: { Upgrade: "websocket" },
      });
      const socket = response.webSocket;
      if (!socket) throw new Error(`StoreHub refused the connection (${response.status})`);
      socket.accept();
      // Deliveries run one at a time in order; a failed handler drops the socket and the queue.
      let queue = Promise.resolve();
      socket.addEventListener("message", (event) => {
        queue = queue
          .then(() => onMessage(JSON.parse(String(event.data)) as Envelope))
          .catch((error: unknown) => {
            console.error({ event: "realtime.handler_failed", orgId, storeId, deviceId, error });
            socket.close(1011, "Message handler failed");
            // Never settles, so nothing already queued behind the failure is delivered.
            return new Promise<void>(() => {});
          });
      });
      return { close: async () => socket.close(1000, "Closed") };
    },
  };
}
