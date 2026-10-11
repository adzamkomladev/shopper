import * as v from "valibot";
import { drizzle } from "drizzle-orm/d1";
import { createStorage } from "unstorage";
import r2Driver from "unstorage/drivers/cloudflare-r2-binding";
import { sqliteCache } from "@shopper/db-sqlite";
import {
  blobUrlAccess,
  memoryWorkflow,
  messageBody,
  scopedKey,
  sequenceSchema,
  uuidV7Schema,
  storedBlobs,
  type BlobUrlOptions,
  type Envelope,
  type Realtime,
  type Sequencer,
  type Workflow,
} from "@shopper/ports";
import type { StoreHub, StoreSequencer } from "./coordination";
export function cloudflareCache(binding: D1Database, now = Date.now) {
  return sqliteCache(drizzle(binding), now);
}
export async function cloudflareBlobs(binding: R2Bucket, options: BlobUrlOptions) {
  const storage = createStorage({ driver: r2Driver({ binding }) });
  const access = await blobUrlAccess(options);
  return { blobs: storedBlobs(storage, access), readSigned: access.read };
}
export function cloudflareSequencer(binding: DurableObjectNamespace<StoreSequencer>): Sequencer {
  return {
    async next(orgId, storeId, floor = 0n) {
      return BigInt(
        await binding.getByName(`${orgId}/${storeId}`).next(orgId, storeId, floor.toString()),
      );
    },
  };
}
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
      socket.addEventListener("message", (event) => {
        // A failed handler drops the socket; the subscriber resubscribes from its cursor.
        Promise.resolve()
          .then(() => onMessage(JSON.parse(String(event.data)) as Envelope))
          .catch((error: unknown) => {
            console.error({ event: "realtime.handler_failed", orgId, storeId, deviceId, error });
            socket.close(1011, "Message handler failed");
          });
      });
      return { close: async () => socket.close(1000, "Closed") };
    },
  };
}
export function cloudflareWorkflow(instanceId: string): Workflow {
  return memoryWorkflow(instanceId);
}

export { cloudflareDatabase } from "./database";
