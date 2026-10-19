import * as v from "valibot";
import { tillId } from "./fields";
import { taxClassSchema, taxRuleSchema } from "@shopper/tax";
import { money } from "@shopper/money";
import { createEventDecoder } from "../events";
import { mappingInput } from "../catalogue/mappings";
import { sequenceSchema } from "@shopper/ports";

const timestamp = v.pipe(v.string(), v.isoTimestamp());
export const cashRoundingSchema = v.picklist(["none", "10p"]);
export type CashRounding = v.InferOutput<typeof cashRoundingSchema>;
/** Organisation settings a till needs offline; stored as one reference row whose id is the org id. */
export const tillOrgSetting = v.strictObject({ id: tillId, cashRounding: cashRoundingSchema });
const cashRounding = v.optional(cashRoundingSchema, "10p");
const productFields = {
  id: tillId,
  orgId: tillId,
  sku: v.string(),
  name: v.string(),
  baseUnit: v.picklist(["each", "kg", "g", "l", "ml"]),
  taxClass: taxClassSchema,
  /** Final-sale products cannot be returned; rows from before v3 omit it. */
  finalSale: v.optional(v.boolean(), false),
  archivedAt: v.nullable(timestamp),
};
export const tillProductBase = v.object(productFields);
const barcodes = v.array(
  v.strictObject({
    code: v.string(),
    quantityThousandths: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  }),
);
export const tillProduct = v.strictObject({ ...productFields, barcodes });
export const tillPrice = v.strictObject({
  id: tillId,
  orgId: tillId,
  productId: tillId,
  branchId: v.nullable(tillId),
  amount: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.transform(money)),
  validFrom: timestamp,
  validTo: v.nullable(timestamp),
});
export const tillTaxRule = v.strictObject({
  ...taxRuleSchema.entries,
  id: tillId,
  orgId: tillId,
  source: v.string(),
});
export const tillMapping = v.pipe(
  v.looseObject({ id: tillId }),
  v.rawTransform(({ dataset, addIssue, NEVER }) => {
    const { id, ...layout } = dataset.value;
    const parsed = v.safeParse(mappingInput, layout);
    if (parsed.success) return { id, ...parsed.output };
    addIssue({ message: "Invalid barcode mapping" });
    return NEVER;
  }),
);
/** Startup provisioning accepts v1 products (no barcodes) and v2 products; barcodes default to none. */
export const tillReference = v.strictObject({
  products: v.array(v.strictObject({ ...productFields, barcodes: v.optional(barcodes, []) })),
  prices: v.array(tillPrice),
  taxRules: v.array(tillTaxRule),
  barcodeMappings: v.optional(v.array(tillMapping), []),
  cashRounding,
});
const tillReferenceV3 = v.strictObject({
  products: v.array(tillProduct),
  prices: v.array(tillPrice),
  taxRules: v.array(tillTaxRule),
  barcodeMappings: v.array(tillMapping),
  // Snapshots cached before the setting existed omit it.
  cashRounding,
});

const payloads = {
  product: tillProduct,
  price: tillPrice,
  "tax-rule": tillTaxRule,
  "barcode-mapping": tillMapping,
};
const remove = v.object({ id: tillId });
const changeV3 = v.pipe(
  v.looseObject({
    seq: sequenceSchema,
    entityId: v.string(),
    entity: v.picklist(Object.keys(payloads) as (keyof typeof payloads)[]),
    op: v.picklist(["upsert", "delete"]),
    v: v.literal(3),
  }),
  v.rawTransform(({ dataset, addIssue, NEVER }) => {
    const change = dataset.value;
    const schema = change.op === "delete" ? remove : payloads[change.entity];
    const parsed = v.safeParse(schema, (change as { payload?: unknown }).payload);
    if (parsed.success) return { ...change, payload: parsed.output };
    addIssue({ message: "Invalid reference change payload" });
    return NEVER;
  }),
);
const snapshotV3 = v.object({
  v: v.literal(3),
  orgId: tillId,
  storeId: tillId,
  cursor: sequenceSchema,
  reference: tillReferenceV3,
});
export type ReferenceChange = v.InferOutput<typeof changeV3>;
export type ReferenceSnapshot = v.InferOutput<typeof snapshotV3>;

type Raw = Record<string, unknown>;
export const decodeReferenceChange = createEventDecoder<ReferenceChange>(
  3,
  (raw) => v.parse(changeV3, raw),
  {
    1: (raw) => {
      const change = raw as Raw & { entity: unknown; op: unknown; payload: Raw };
      const product = change.entity === "product" && change.op === "upsert";
      return {
        ...change,
        v: 2,
        payload: product ? { ...change.payload, barcodes: [] } : change.payload,
      };
    },
    2: (raw) => ({ ...(raw as Raw), v: 3 }),
  },
);
export const decodeSnapshot = createEventDecoder<ReferenceSnapshot>(
  3,
  (raw) => v.parse(snapshotV3, raw),
  {
    1: (raw) => {
      const snapshot = raw as Raw & { reference: { products: Raw[] } };
      const { products } = snapshot.reference;
      return {
        ...snapshot,
        v: 2,
        reference: {
          ...snapshot.reference,
          products: products.map((p) => ({ ...p, barcodes: [] })),
          barcodeMappings: [],
        },
      };
    },
    2: (raw) => ({ ...(raw as Raw), v: 3 }),
  },
);
