import * as v from "valibot";
import { money } from "@shopper/money";
import { customerSnapshot } from "../customers/inputs";
import { createEventDecoder } from "../events";
import { tillId } from "./fields";
import { dateSchema, taxClassSchema, taxRuleSchema } from "@shopper/tax";

const amount = v.pipe(v.number(), v.safeInteger(), v.transform(money));
const nonnegative = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.transform(money));
export const saleTotals = v.strictObject({
  base: amount,
  vat: amount,
  nhil: amount,
  getfund: amount,
  covid: amount,
  gross: amount,
  roundingAdjustment: amount,
});
export const saleTaxSnapshot = v.strictObject({
  ...saleTotals.entries,
  rule: v.strictObject({ ...taxRuleSchema.entries, id: tillId }),
  on: dateSchema,
  taxClass: taxClassSchema,
  priceMode: v.picklist(["inclusive", "exclusive"]),
  /** False when the shop was not VAT-registered on the sale date: the line then carries no VAT or levies. */
  registered: v.boolean(),
  quantityThousandths: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  unitPrice: nonnegative,
  discount: nonnegative,
});
const saleSnapshotBase = v.strictObject({
  id: tillId,
  localId: tillId,
  orgId: tillId,
  deviceId: tillId,
  storeId: tillId,
  branchId: tillId,
  cashierId: tillId,
  sessionId: tillId,
  appVersion: v.pipe(v.string(), v.minLength(1)),
  deviceTime: v.pipe(v.string(), v.isoTimestamp()),
  lines: v.pipe(
    v.array(
      v.strictObject({
        id: tillId,
        productId: tillId,
        priceId: tillId,
        sku: v.string(),
        name: v.string(),
        baseUnit: v.picklist(["each", "kg", "g", "l", "ml"]),
        tax: saleTaxSnapshot,
        discount: nonnegative,
        /** A changed unit price: the list price it replaced, why, and the manager who approved it (null when the cashier held the grant). */
        override: v.nullable(
          v.strictObject({
            listPrice: nonnegative,
            reason: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500)),
            approverId: v.nullable(tillId),
          }),
        ),
        label: v.nullable(
          v.variant("kind", [
            v.strictObject({ kind: v.literal("weight"), code: v.string() }),
            v.strictObject({ kind: v.literal("price"), code: v.string(), originalPriceId: tillId }),
          ]),
        ),
      }),
    ),
    v.minLength(1),
  ),
  totals: saleTotals,
});
export const saleSnapshot = v.strictObject({
  ...saleSnapshotBase.entries,
  receiptNumber: v.nullable(v.pipe(v.string(), v.regex(/^BR[0-9]+-T[0-9]+-X?[0-9]{6,}$/))),
  receiptOverflow: v.boolean(),
  clockOffsetMs: v.pipe(v.number(), v.safeInteger()),
  cashRounding: amount,
  total: nonnegative,
  paid: nonnegative,
  change: nonnegative,
  /** Who the sale was rung up to, as the till knew them; the buyer on the receipt comes from it. */
  customer: v.optional(v.nullable(customerSnapshot), null),
  tenders: v.pipe(
    v.array(
      v.pipe(
        v.strictObject({
          id: tillId,
          kind: v.picklist(["cash", "momo", "card", "credit", "loyalty"]),
          amount: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.transform(money)),
          /** Points a loyalty tender spends, whole and worth `amount` at the point value of its hold. */
          points: v.optional(v.pipe(v.number(), v.safeInteger(), v.minValue(1))),
          reference: v.optional(v.string()),
          approvalCode: v.optional(v.pipe(v.string(), v.regex(/^[a-zA-Z0-9]{4,12}$/))),
          last4: v.optional(v.pipe(v.string(), v.regex(/^[0-9]{4}$/))),
          network: v.optional(v.string()),
        }),
        v.check((t) => t.amount > 0 || t.kind === "cash", "Only cash may have a zero amount"),
        v.check((t) => t.kind !== "card" || t.approvalCode !== undefined, "Card approval required"),
        v.check((t) => t.kind !== "momo" || t.reference !== undefined, "MoMo reference required"),
        v.check(
          (t) => (t.kind === "loyalty") === (t.points !== undefined),
          "Points belong to the loyalty tender",
        ),
      ),
    ),
    v.minLength(1),
    // An account tender spends the customer's server hold, whose id is the tender id.
    v.check((ts) => ts.filter((t) => t.kind === "credit").length <= 1, "One credit tender at most"),
    v.check(
      (ts) => ts.filter((t) => t.kind === "loyalty").length <= 1,
      "One loyalty tender at most",
    ),
  ),
});
/** Just the buyer of a stored sale: what a refund needs, without the rest of the payload parsing. */
export const saleCustomer = v.object({ customer: saleSnapshot.entries.customer });
export const saleEvent = v.strictObject({
  v: v.literal(6),
  type: v.literal("sale.recorded"),
  sale: saleSnapshot,
});
export const recordSaleInput = v.strictObject({
  lines: v.pipe(
    v.array(
      v.strictObject({
        productId: tillId,
        quantityThousandths: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
      }),
    ),
    v.minLength(1),
  ),
});
export type SaleEvent = v.InferOutput<typeof saleEvent>;
export type SaleSnapshot = v.InferOutput<typeof saleSnapshot>;

/** Every line of a sale or refund event from before registration was dated was taxed as a registered shop's. */
export const registeredLines = <T extends { lines?: unknown[] }>(body: T) => ({
  ...body,
  lines: (body.lines ?? []).map((line) => {
    const { tax, ...rest } = line as { tax: object };
    return { ...rest, tax: { registered: true, ...tax } };
  }),
});

/** v4 had no customer: a stored v4 sale reads as a walk-in. v5 lines had no registration flag. */
export const decodeSaleEvent = createEventDecoder(6, (raw) => v.parse(saleEvent, raw), {
  4: (raw) => ({ ...(raw as object), v: 5 }),
  5: (raw) => {
    const event = raw as { sale: { lines?: unknown[] } };
    return { ...event, v: 6, sale: registeredLines(event.sale) };
  },
});
