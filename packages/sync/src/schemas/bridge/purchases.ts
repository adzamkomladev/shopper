import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { receiptDocument, saleSnapshot, purchaseFilters } from "@shopper/core/schemas";
import { momoView } from "@shopper/core/payments";
import { draftView } from "./basket";
const id = uuidV7Schema;
const revision = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
export const purchaseRequests = [
  v.strictObject({
    id,
    type: v.literal("sales.list"),
    expectedRevision: revision,
    ...purchaseFilters,
  }),
  v.strictObject({ id, type: v.literal("sales.read"), expectedRevision: revision, saleId: id }),
] as const;
export const purchaseSummary = v.strictObject({
  id,
  status: v.picklist(["completed", "voided", "pending"]),
  receiptNumber: v.nullable(v.string()),
  occurredAt: v.pipe(v.string(), v.isoTimestamp()),
  total: v.number(),
  kinds: v.array(v.picklist(["cash", "momo", "card"])),
});
export const receiptDelivery = v.strictObject({
  printedAt: v.nullable(v.string()),
  reprints: revision,
  printError: v.nullable(v.string()),
  /** Null when no PDF is stored yet. */
  pdf: v.nullable(v.picklist(["pending", "uploaded"])),
});
export const purchaseDetails = v.strictObject({
  ...purchaseSummary.entries,
  payment: v.optional(v.nullable(momoView)),
  sale: v.nullable(saleSnapshot),
  receipt: v.nullable(receiptDocument),
  draft: v.nullable(draftView),
  /** Null unless the purchase is a completed sale. */
  delivery: v.nullable(receiptDelivery),
});
export const purchaseReplies = [
  v.strictObject({
    id,
    type: v.literal("result"),
    kind: v.literal("purchases"),
    purchases: v.array(purchaseSummary),
    total: revision,
    page: revision,
    pageSize: revision,
  }),
  v.strictObject({
    id,
    type: v.literal("result"),
    kind: v.literal("purchase"),
    purchase: purchaseDetails,
  }),
] as const;
export type PurchaseSummary = v.InferOutput<typeof purchaseSummary>;
export type ReceiptDelivery = v.InferOutput<typeof receiptDelivery>;
export type PurchaseDetails = v.InferOutput<typeof purchaseDetails>;
