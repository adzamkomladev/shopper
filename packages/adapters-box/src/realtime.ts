import * as v from "valibot";
import {
  messageBody,
  scopedKey,
  sequenceSchema,
  uuidV7Schema,
  type Envelope,
  type Realtime,
} from "@shopper/ports";

interface Subscriber {
  deliver(message: Envelope): void;
}
interface Hub {
  log: Envelope[];
  devices: Map<string, Subscriber>;
}

// ponytail: in-process hub, one per box process; the Rivet StoreHub actor replaces it on day 36.
export function boxRealtime(replayLimit = 500): Realtime {
  const hubs = new Map<string, Hub>();
  const hub = (orgId: string, storeId: string) => {
    const key = scopedKey(orgId, storeId);
    let found = hubs.get(key);
    if (!found) hubs.set(key, (found = { log: [], devices: new Map() }));
    return found;
  };
  return {
    async publish(orgId, storeId, message) {
      if (message.orgId !== orgId) throw new Error("Message belongs to another organization");
      const parsed = JSON.parse(messageBody(message)) as Envelope;
      const target = hub(orgId, storeId);
      target.log.push(parsed);
      if (target.log.length > replayLimit) target.log.shift();
      for (const subscriber of target.devices.values()) subscriber.deliver(parsed);
    },
    async subscribe(orgId, storeId, deviceId, cursor, onMessage) {
      v.parse(uuidV7Schema, deviceId);
      const after = BigInt(v.parse(sequenceSchema, cursor));
      const target = hub(orgId, storeId);
      // Deliveries run one at a time in order; a failing handler drops the device, as on Cloudflare.
      let queue = Promise.resolve();
      const subscriber: Subscriber = {
        deliver(message) {
          queue = queue
            .then(() => onMessage(message))
            .catch((error: unknown) => {
              console.error({ event: "realtime.handler_failed", orgId, storeId, deviceId, error });
              if (target.devices.get(deviceId) === subscriber) target.devices.delete(deviceId);
              queue = new Promise(() => {}); // Nothing more reaches a dropped device.
            });
        },
      };
      // Register before replaying so nothing published meanwhile is missed; one socket per device.
      target.devices.set(deviceId, subscriber);
      for (const message of target.log.filter((m) => BigInt(m.sequence) > after))
        subscriber.deliver(message);
      return {
        async close() {
          if (target.devices.get(deviceId) === subscriber) target.devices.delete(deviceId);
        },
      };
    },
  };
}
