import * as v from "valibot";
import { uuidV7Schema, sequenceSchema } from "@shopper/ports";
import { recordSaleInput, saleEvent } from "@shopper/core/schemas";

const identityId = v.pipe(
  uuidV7Schema,
  v.transform((id) => id.toLowerCase()),
);
export const registerIdentity = v.strictObject({
  orgId: identityId,
  deviceId: identityId,
  storeId: identityId,
  branchId: identityId,
  shopName: v.pipe(v.string(), v.minLength(1)),
  registerName: v.pipe(v.string(), v.minLength(1)),
});
export const hostStatus = v.strictObject({
  identity: registerIdentity,
  appVersion: v.pipe(v.string(), v.minLength(1)),
  protocol: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  server: v.picklist(["connecting", "online", "offline", "blocked", "revoked", "incompatible"]),
  pendingCount: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  blockedCount: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  mode: v.picklist(["live", "polling", "offline"]),
  cursor: v.nullable(sequenceSchema),
  head: v.nullable(sequenceSchema),
  lastPullAt: v.nullable(
    v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(8_640_000_000_000_000)),
  ),
  receiptsLeft: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  overflow: v.boolean(),
  syncing: v.boolean(),
  lastError: v.nullable(v.strictObject({ code: v.string(), message: v.string() })),
  lastSuccessfulPushAt: v.nullable(
    v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(8_640_000_000_000_000)),
  ),
});
const id = uuidV7Schema;
export const bridgeRequest = v.variant("type", [
  v.strictObject({
    id,
    type: v.literal("hello"),
    capability: v.string(),
    appVersion: v.string(),
    protocol: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  }),
  v.strictObject({ id, type: v.literal("status") }),
  v.strictObject({ id, type: v.literal("retry") }),
  v.strictObject({ id, type: v.literal("recordSale"), input: recordSaleInput }),
  v.strictObject({ id, type: v.literal("shutdown") }),
]);
export const bridgeMessage = v.union([
  v.strictObject({ id, type: v.literal("result"), kind: v.literal("status"), status: hostStatus }),
  v.strictObject({ id, type: v.literal("result"), kind: v.literal("sale"), event: saleEvent }),
  v.strictObject({
    id: v.optional(id),
    type: v.literal("error"),
    code: v.string(),
    message: v.string(),
  }),
  v.strictObject({ type: v.literal("status"), status: hostStatus }),
]);
export type HostStatus = v.InferOutput<typeof hostStatus>;
export type BridgeRequest = v.InferOutput<typeof bridgeRequest>;
export type BridgeMessage = v.InferOutput<typeof bridgeMessage>;
