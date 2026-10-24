import * as v from "valibot";
import { tillId } from "./fields";
import { dateSchema, taxClassSchema, taxRuleSchema } from "@shopper/tax";
import { money } from "@shopper/money";
import { createEventDecoder } from "../events";
import { mappingInput } from "../catalogue/mappings";
import { sequenceSchema } from "@shopper/ports";
import { ghanaPhone } from "../fields";
import { customerId, customerKindSchema, tinSchema } from "../customers/inputs";

const timestamp = v.pipe(v.string(), v.isoTimestamp());
export const cashRoundingSchema = v.picklist(["none", "10p"]);
export type CashRounding = v.InferOutput<typeof cashRoundingSchema>;
/**
 * Organisation settings a till needs offline; stored as one reference row whose id is the org id. Rows a till saved
 * before v5 held only the rounding: they default to an inclusive price list, VAT-registered from the statutory start.
 */
export const tillOrgSetting = v.strictObject({
  id: tillId,
  cashRounding: cashRoundingSchema,
  priceMode: v.optional(v.picklist(["inclusive", "exclusive"]), "inclusive"),
  vatRegisteredFrom: v.optional(v.nullable(dateSchema), "2026-01-01"),
  tin: v.optional(v.nullable(tinSchema), null),
});
export type TillOrgSetting = v.InferOutput<typeof tillOrgSetting>;
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
/**
 * What a till needs to recognise a customer. The limit, the ledgers and the email stay on the server, and the strict
 * object keeps it so: a new column never reaches a till by accident.
 */
export const tillCustomer = v.strictObject({
  id: customerId,
  orgId: tillId,
  name: v.string(),
  phone: ghanaPhone,
  kind: customerKindSchema,
  businessName: v.nullable(v.string()),
  tin: v.nullable(tinSchema),
  version: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  archivedAt: v.nullable(timestamp),
  mergedIntoId: v.nullable(tillId),
});
/** Startup provisioning accepts v1 products (no barcodes) and v2 products; barcodes default to none. */
export const tillReference = v.strictObject({
  products: v.array(v.strictObject({ ...productFields, barcodes: v.optional(barcodes, []) })),
  prices: v.array(tillPrice),
  taxRules: v.array(tillTaxRule),
  barcodeMappings: v.optional(v.array(tillMapping), []),
  cashRounding,
});
const tillReferenceV5 = v.strictObject({
  products: v.array(tillProduct),
  prices: v.array(tillPrice),
  taxRules: v.array(tillTaxRule),
  barcodeMappings: v.array(tillMapping),
  customers: v.array(tillCustomer),
  settings: tillOrgSetting,
});

const payloads = {
  product: tillProduct,
  price: tillPrice,
  "tax-rule": tillTaxRule,
  "barcode-mapping": tillMapping,
  customer: tillCustomer,
  "org-setting": tillOrgSetting,
};
const remove = v.object({ id: tillId });
const changeV5 = v.pipe(
  v.looseObject({
    seq: sequenceSchema,
    entityId: v.string(),
    entity: v.picklist(Object.keys(payloads) as (keyof typeof payloads)[]),
    op: v.picklist(["upsert", "delete"]),
    v: v.literal(5),
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
const snapshotV5 = v.object({
  v: v.literal(5),
  orgId: tillId,
  storeId: tillId,
  cursor: sequenceSchema,
  reference: tillReferenceV5,
});
export type ReferenceChange = v.InferOutput<typeof changeV5>;
export type ReferenceSnapshot = v.InferOutput<typeof snapshotV5>;

type Raw = Record<string, unknown>;
export const decodeReferenceChange = createEventDecoder<ReferenceChange>(
  5,
  (raw) => v.parse(changeV5, raw),
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
    3: (raw) => ({ ...(raw as Raw), v: 4 }),
    // v5 only added the org-setting entity.
    4: (raw) => ({ ...(raw as Raw), v: 5 }),
  },
);
export const decodeSnapshot = createEventDecoder<ReferenceSnapshot>(
  5,
  (raw) => v.parse(snapshotV5, raw),
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
    // Customers came with v4; an older till's snapshot simply has none.
    3: (raw) => {
      const snapshot = raw as Raw & { reference: Raw };
      return { ...snapshot, v: 4, reference: { ...snapshot.reference, customers: [] } };
    },
    // v5 carries all the org's till settings; a v4 snapshot had only the rounding (omitted before it existed).
    4: (raw) => {
      const snapshot = raw as Raw & { orgId: string; reference: Raw & { cashRounding?: unknown } };
      const { cashRounding = "10p", ...reference } = snapshot.reference;
      return {
        ...snapshot,
        v: 5,
        reference: { ...reference, settings: { id: snapshot.orgId, cashRounding } },
      };
    },
  },
);
