import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { saleTaxSnapshot, saleTotals } from "@shopper/core/schemas";
import { approval } from "./approvals";
import { basketCustomer } from "./customers";

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
  v.strictObject({
    id,
    type: v.literal("tender.add"),
    expectedRevision: revision,
    kind: v.picklist(["cash", "card"]),
    amount: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
    approvalCode: v.optional(v.pipe(v.string(), v.regex(/^[a-zA-Z0-9]{4,12}$/))),
    last4: v.optional(v.pipe(v.string(), v.regex(/^\d{4}$/))),
  }),
  v.strictObject({
    id,
    type: v.literal("tender.remove"),
    expectedRevision: revision,
    tenderId: id,
  }),
  v.strictObject({
    id,
    type: v.literal("discount.set"),
    expectedRevision: revision,
    lineId: id,
    discount: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  }),
  v.strictObject({
    id,
    type: v.literal("line.price"),
    expectedRevision: revision,
    lineId: id,
    unitPrice: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
    reason: v.pipe(text, v.trim(), v.minLength(1), v.maxLength(500)),
    approval: v.optional(approval),
  }),
  v.strictObject({ id, type: v.literal("sale.complete"), expectedRevision: revision }),
  v.strictObject({
    id,
    type: v.literal("payment.momo.start"),
    expectedRevision: revision,
    phone: v.pipe(v.string(), v.regex(/^(?:0\d{9}|\+233\d{9})$/)),
    network: v.picklist(["mtn", "telecel", "airteltigo"]),
    amount: v.pipe(v.number(), v.safeInteger(), v.minValue(100), v.multipleOf(100)),
  }),
  v.strictObject({
    id,
    type: v.literal("payment.momo.otp"),
    expectedRevision: revision,
    reference: id,
    otp: v.pipe(v.string(), v.regex(/^\d{4,10}$/)),
  }),
  v.strictObject({
    id,
    type: v.literal("sale.hold"),
    expectedRevision: revision,
    name: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(100))),
  }),
  v.strictObject({ id, type: v.literal("sale.resume"), expectedRevision: revision, draftId: id }),
  v.strictObject({ id, type: v.literal("sale.listHeld"), expectedRevision: revision }),
  v.strictObject({
    id,
    type: v.literal("sale.void"),
    expectedRevision: revision,
    reason: v.pipe(text, v.trim(), v.minLength(1), v.maxLength(500)),
    draftId: v.optional(id),
    approval: v.optional(approval),
  }),
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
    originalPriceId: id,
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
    listPrice: v.optional(v.number()),
  }),
  v.strictObject({ lineId: id, productId: v.string(), error: text }),
]);

/** The requoted basket of the signed-in cashier; `draft: null` is an empty basket at revision 0. */
export const draftView = v.strictObject({
  draft: v.nullable(
    v.strictObject({
      id,
      status: v.picklist(["open", "held", "voided"]),
      name: v.nullable(v.string()),
      voidReason: v.optional(v.nullable(v.string())),
      heldAt: v.optional(v.nullable(stamp)),
      voidedAt: v.optional(v.nullable(stamp)),
      tenders: v.array(
        v.strictObject({
          id,
          orgId: id,
          draftId: id,
          position: revision,
          kind: v.picklist(["cash", "momo", "card"]),
          amount: v.number(),
          reference: v.nullable(v.string()),
          approvalCode: v.nullable(v.string()),
          last4: v.nullable(v.string()),
          phone: v.nullable(v.string()),
          network: v.nullable(v.string()),
          status: v.picklist(["applied", "pending", "otp", "confirmed", "failed", "expired"]),
          createdAt: stamp,
        }),
      ),
      revision: v.pipe(revision, v.minValue(1)),
      createdAt: stamp,
      updatedAt: stamp,
      lines: v.array(
        v.strictObject({
          id,
          productId: id,
          quantityThousandths: v.number(),
          discount: v.number(),
          label: v.optional(draftLabel),
          override: v.optional(
            v.strictObject({
              unitPrice: v.number(),
              reason: v.string(),
              approverId: v.nullable(id),
            }),
          ),
        }),
      ),
    }),
  ),
  cashRounding: v.optional(v.picklist(["none", "10p"])),
  customer: v.optional(v.nullable(basketCustomer)),
  settlementError: v.optional(v.string()),
  settlement: v.optional(
    v.strictObject({
      gross: v.number(),
      roundingLine: v.number(),
      total: v.number(),
      nonCash: v.number(),
      cash: v.number(),
      balance: v.number(),
      change: v.number(),
    }),
  ),
  quote: v.strictObject({ lines: v.array(quotedLine), totals: saleTotals, changed: v.boolean() }),
});

export const basketReplies = [
  v.strictObject({
    id,
    type: v.literal("result"),
    kind: v.literal("held"),
    views: v.array(draftView),
  }),
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
