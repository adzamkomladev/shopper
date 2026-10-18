import * as v from "valibot";

/** One queued, sent or rejected stock document, as the register host lists it. */
export const stockQueueRow = v.object({
  id: v.string(),
  kind: v.picklist(["count", "receipt"]),
  status: v.picklist(["queued", "sent", "rejected"]),
  createdAt: v.string(),
  blockedReason: v.nullable(v.string()),
  payload: v.object({ lines: v.array(v.unknown()) }),
});
export const stockQueue = v.array(stockQueueRow);
export type StockQueueRow = v.InferOutput<typeof stockQueueRow>;

/** A product the register can count or receive. */
export const stockProduct = v.object({ productId: v.string(), sku: v.string(), name: v.string() });
export const stockProducts = v.array(stockProduct);
export type StockProduct = v.InferOutput<typeof stockProduct>;

export const queuedStock = v.object({ id: v.string() });
