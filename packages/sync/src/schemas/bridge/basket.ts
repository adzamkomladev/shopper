import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { saleTaxSnapshot, saleTotals } from "@shopper/core/schemas";

const id = uuidV7Schema;
const text = v.pipe(v.string(), v.minLength(1));
const revision = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
// Domain validation (positive whole thousandths) happens on the host so it answers QUANTITY_INVALID.
const quantity = v.number();
const stamp = v.pipe(v.string(), v.isoTimestamp());

/** Basket requests carry no scope: organisation, device, branch and cashier come from the host configuration. */
export const basketRequests = [
  v.strictObject({ id, type: v.literal("search"), query: v.pipe(v.string(), v.maxLength(200)) }),
  v.strictObject({ id, type: v.literal("readDraft") }),
  v.strictObject({
    id,
    type: v.literal("add"),
    expectedRevision: revision,
    code: v.optional(v.pipe(text, v.maxLength(64))),
    productId: v.optional(id),
    quantityThousandths: v.optional(quantity),
  }),
  v.strictObject({
    id,
    type: v.literal("setQuantity"),
    expectedRevision: revision,
    lineId: id,
    quantityThousandths: quantity,
  }),
  v.strictObject({ id, type: v.literal("removeLine"), expectedRevision: revision, lineId: id }),
] as const;
export const basketRequestTypes = basketRequests.map((schema) => schema.entries.type.literal);

export const catalogueMatch = v.strictObject({
  productId: id,
  sku: v.string(),
  name: v.string(),
  match: v.picklist(["barcode", "sku", "name"]),
  barcode: v.optional(v.string()),
  quantityThousandths: v.optional(v.number()),
});

const draftLabel = v.variant("kind", [
  v.strictObject({ kind: v.literal("weight"), code: v.string() }),
  v.strictObject({
    kind: v.literal("price"),
    code: v.string(),
    gross: v.number(),
    originalQuantityThousandths: v.number(),
  }),
]);
const quotedLine = v.union([
  v.strictObject({
    lineId: id,
    productId: id,
    priceId: id,
    sku: v.string(),
    name: v.string(),
    baseUnit: v.string(),
    tax: saleTaxSnapshot,
  }),
  v.strictObject({ lineId: id, productId: v.string(), error: text }),
]);

/** The requoted basket of the signed-in cashier; `draft: null` is an empty basket at revision 0. */
export const draftView = v.strictObject({
  draft: v.nullable(
    v.strictObject({
      id,
      revision: v.pipe(revision, v.minValue(1)),
      createdAt: stamp,
      updatedAt: stamp,
      lines: v.array(
        v.strictObject({
          id,
          productId: id,
          quantityThousandths: v.number(),
          label: v.optional(draftLabel),
        }),
      ),
    }),
  ),
  quote: v.strictObject({ lines: v.array(quotedLine), totals: saleTotals, changed: v.boolean() }),
});

export const basketReplies = [
  v.strictObject({
    id,
    type: v.literal("result"),
    kind: v.literal("search"),
    query: v.string(),
    matches: v.array(catalogueMatch),
  }),
  v.strictObject({ id, type: v.literal("result"), kind: v.literal("draft"), view: draftView }),
] as const;

export type DraftView = v.InferOutput<typeof draftView>;
export type CatalogueMatch = v.InferOutput<typeof catalogueMatch>;
