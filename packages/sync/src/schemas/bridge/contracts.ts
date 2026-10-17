import * as v from "valibot";
import { uuidV7Schema, sequenceSchema } from "@shopper/ports";
import { receiptDocument, recordSaleInput, saleEvent } from "@shopper/core/schemas";
import { basketReplies, basketRequests, draftView } from "./basket";

import { momoView } from "@shopper/core/payments";
import { purchaseReplies, purchaseRequests } from "./purchases";
import { deviceRequests, printerStatus, settingsStatus } from "./devices";

const id = uuidV7Schema;

export const identityId = v.pipe(
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
  permissions: v.optional(v.array(v.string())),
  settings: settingsStatus,
  printer: printerStatus,
  registerCode: v.string(),
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
export const bridgeRequest = v.pipe(
  v.variant("type", [
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
    ...basketRequests,
    ...purchaseRequests,
    ...deviceRequests,
  ]),
  v.check(
    (request) =>
      request.type !== "add" || (request.code === undefined) !== (request.productId === undefined),
    "Add a scanned code or a product, not both",
  ),
);
export const bridgeMessage = v.union([
  v.strictObject({ id, type: v.literal("result"), kind: v.literal("status"), status: hostStatus }),
  v.strictObject({
    id,
    type: v.literal("result"),
    kind: v.literal("sale"),
    event: saleEvent,
    receipt: receiptDocument,
  }),
  ...basketReplies,
  ...purchaseReplies,
  v.strictObject({
    id: v.optional(id),
    type: v.literal("error"),
    code: v.string(),
    message: v.string(),
  }),
  v.strictObject({ type: v.literal("status"), status: hostStatus }),
  v.strictObject({ type: v.literal("draft"), view: draftView }),
  v.strictObject({ type: v.literal("payment"), payment: momoView }),
]);
/** Error codes that end the connection; every other error answers one request and the socket stays open. */
export const connectionErrors: readonly string[] = [
  "UNAUTHORIZED",
  "INCOMPATIBLE_PROTOCOL",
  "INVALID_MESSAGE",
];
export type HostStatus = v.InferOutput<typeof hostStatus>;
export type BridgeRequest = v.InferOutput<typeof bridgeRequest>;
export type BridgeMessage = v.InferOutput<typeof bridgeMessage>;
