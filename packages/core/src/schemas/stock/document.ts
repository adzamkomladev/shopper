import * as v from "valibot";
import { tillId } from "../till/fields";

export const quantity = (min: number) => v.pipe(v.number(), v.safeInteger(), v.minValue(min));
const timestamp = v.pipe(v.string(), v.isoTimestamp());
const text = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200));

/** Lines name each product once; a document with no lines or a repeated product is malformed. */
export const lines = <E extends v.ObjectEntries>(entries: E) =>
  v.pipe(
    v.array(v.strictObject({ productId: tillId, ...entries })),
    v.minLength(1),
    v.maxLength(500),
    v.check(
      (rows) => new Set(rows.map((row) => row.productId)).size === rows.length,
      "A product appears once per stock document",
    ),
  );

const head = { v: v.literal(1), id: tillId, actorId: tillId, sessionId: tillId };

export const stockCount = v.strictObject({
  ...head,
  kind: v.literal("count"),
  lines: lines({ countedThousandths: quantity(0) }),
  countedAt: timestamp,
});

export const stockReceipt = v.strictObject({
  ...head,
  kind: v.literal("receipt"),
  supplier: v.optional(text),
  reference: v.optional(text),
  lines: lines({ quantityThousandths: quantity(1) }),
  receivedAt: timestamp,
});

export const stockDocumentSchema = v.variant("kind", [stockCount, stockReceipt]);

export type StockCount = v.InferOutput<typeof stockCount>;
export type StockReceipt = v.InferOutput<typeof stockReceipt>;
export type StockDocument = v.InferOutput<typeof stockDocumentSchema>;
