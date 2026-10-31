import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { receiptsSchema } from "../receipts";

export const updateChannels = ["pilot", "stable"] as const;

// Not strict: a server that adds a field must not turn every till already in a shop "incompatible".
export const handshake = v.object({
  requestId: uuidV7Schema,
  protocol: v.pipe(v.number(), v.integer()),
  appVersion: v.pipe(v.string(), v.minLength(1)),
  serverTime: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  receipts: v.optional(receiptsSchema),
  /** The oldest till version allowed to open a shift; null when there is none. */
  minTillVersion: v.optional(v.nullable(v.pipe(v.string(), v.minLength(1)))),
  updateChannel: v.optional(v.picklist(updateChannels)),
});
