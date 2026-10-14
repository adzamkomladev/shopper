import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { name, positiveInt, text, timestamp } from "../fields";

export const barcodeInput = v.strictObject({
  code: text(64),
  quantityThousandths: v.optional(positiveInt, 1000),
});
const productFields = {
  sku: text(64),
  name,
  baseUnit: v.picklist(["each", "kg", "g", "l", "ml"]),
  taxClass: v.picklist(["standard", "zero-rated", "exempt"]),
  categoryId: v.nullable(uuidV7Schema),
  supplierId: v.nullable(uuidV7Schema),
  onlineVisible: v.boolean(),
};
export const productInput = v.strictObject({
  ...productFields,
  categoryId: v.optional(productFields.categoryId),
  supplierId: v.optional(productFields.supplierId),
  onlineVisible: v.optional(productFields.onlineVisible, false),
  barcodes: v.optional(v.array(barcodeInput), []),
});
export const productPatch = v.partial(v.strictObject(productFields));
export const listQuery = v.object({
  q: v.optional(text(100)),
  categoryId: v.optional(uuidV7Schema),
  cursor: v.optional(uuidV7Schema),
  limit: v.optional(
    v.pipe(v.string(), v.transform(Number), v.safeInteger(), v.minValue(1), v.maxValue(200)),
    "50",
  ),
});
export const priceInput = v.strictObject({
  amount: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  branchId: v.optional(uuidV7Schema),
  validFrom: v.optional(timestamp),
});
export const lookupQuery = v.object({
  branchId: v.optional(uuidV7Schema),
  at: v.optional(timestamp),
});
export const priceAtQuery = v.object({ ...lookupQuery.entries, productId: uuidV7Schema });

const contact = v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(200))));
export const categoryInput = v.strictObject({
  name,
  parentId: v.optional(v.nullable(uuidV7Schema)),
});
export const supplierInput = v.strictObject({ name, phone: contact, email: contact, tin: contact });

export const priceChangeParams = v.object({
  orgId: uuidV7Schema,
  priceId: uuidV7Schema,
  actorId: v.optional(uuidV7Schema),
  startsAt: timestamp,
  endsAt: timestamp,
});

export const scheduleInput = v.pipe(
  v.strictObject({
    amount: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
    branchId: v.optional(uuidV7Schema),
    startsAt: timestamp,
    endsAt: timestamp,
  }),
  v.check((data) => data.endsAt > data.startsAt, "endsAt must be after startsAt"),
  v.check((data) => data.endsAt.getTime() > Date.now(), "endsAt must be in the future"),
);

export const categoryUpdate = v.partial(categoryInput);
export const supplierUpdate = v.partial(supplierInput);
