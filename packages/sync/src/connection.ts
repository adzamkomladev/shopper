import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { receiptsSchema } from "./receipts";
import { negotiateProtocol } from "./versions";

const handshake = v.strictObject({
  requestId: uuidV7Schema,
  protocol: v.pipe(v.number(), v.integer()),
  appVersion: v.pipe(v.string(), v.minLength(1)),
  serverTime: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  receipts: v.optional(receiptsSchema),
});
export function readHandshake(raw: unknown, requestId: string, protocol: number) {
  const result = v.parse(handshake, raw);
  if (result.requestId !== requestId || negotiateProtocol(protocol, result.protocol) === undefined)
    throw new Error("Invalid handshake");
  return result;
}
