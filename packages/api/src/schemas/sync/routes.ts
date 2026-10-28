const maxBatch = 200;

import * as v from "valibot";

import { managementId } from "@shopper/core/management";
import { sessionCredential } from "./session";

export const protocolSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
export const receiptLastUsed = v.optional(v.pipe(v.number(), v.safeInteger(), v.minValue(0)), 0);
export const handshake = v.strictObject({
  requestId: managementId,
  appVersion: v.pipe(v.string(), v.minLength(1)),
  protocol: protocolSchema,
  receiptLastUsed,
});
export const envelope = v.strictObject({
  requestId: managementId,
  protocol: protocolSchema,
  receiptLastUsed,
  events: v.pipe(v.array(v.unknown()), v.maxLength(maxBatch)),
  proofs: v.pipe(
    v.array(
      v.strictObject({
        sessionId: managementId,
        ...sessionCredential,
      }),
    ),
    v.maxLength(maxBatch),
  ),
});
export const identity = v.object({ sale: v.object({ localId: managementId }) });

export const saleVersion = v.object({ v: v.picklist([4, 5, 6, 7]) });

export const saleSession = v.object({ sale: v.object({ sessionId: managementId }) });

export const stockUpload = v.strictObject({
  requestId: managementId,
  document: v.unknown(),
  ...sessionCredential,
});
