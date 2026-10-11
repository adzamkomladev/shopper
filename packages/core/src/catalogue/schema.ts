import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { taxClass, type ShopperDatabase, type ShopperTransaction } from "@shopper/db-pg";
import { uuidV7Schema } from "@shopper/ports";
import { ManagementError } from "../management";

export type Queryable = ShopperDatabase | ShopperTransaction;

const text = (max: number) => v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(max));
const name = text(200);
const positiveInt = v.pipe(v.number(), v.safeInteger(), v.minValue(1), v.maxValue(2_147_483_647));
// Strict ISO 8601 with Z or ±hh:mm, on a real calendar day (no silent 31 Feb -> 3 Mar roll-over).
export const timestamp = v.pipe(
  v.string(),
  v.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/),
  v.check((value) => {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number) as [
      number,
      number,
      number,
    ];
    return (
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
    );
  }, "Invalid calendar date"),
  v.transform((value) => new Date(value)),
  v.check((date) => !Number.isNaN(date.getTime()), "Invalid timestamp"),
);

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

/** Ids are UUIDv7; anything else cannot exist, so it reads as not found. */
export function recordId(id: string) {
  const parsed = v.safeParse(uuidV7Schema, id);
  if (!parsed.success) throw new ManagementError("Record not found");
  return parsed.output.toLowerCase();
}
export function nonEmpty<T extends object>(data: T) {
  if (!Object.values(data).some((value) => value !== undefined))
    throw new ManagementError("Provide at least one field", 400);
  return data;
}
export async function taxClassId(
  tx: Queryable,
  orgId: string,
  code: (typeof taxClass.$inferSelect)["code"],
) {
  const [row] = await tx
    .select({ id: taxClass.id })
    .from(taxClass)
    .where(and(eq(taxClass.orgId, orgId), eq(taxClass.code, code)));
  if (!row) throw new ManagementError("Unknown tax class", 400);
  return row.id;
}
