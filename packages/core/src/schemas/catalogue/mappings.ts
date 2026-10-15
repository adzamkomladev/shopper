import * as v from "valibot";

const digit = v.pipe(v.number(), v.safeInteger());
const slice = v.strictObject({
  start: v.pipe(digit, v.minValue(2), v.maxValue(11)),
  length: v.pipe(digit, v.minValue(1), v.maxValue(10)),
});
const fields = {
  prefix: v.pipe(digit, v.minValue(20), v.maxValue(29)),
  product: slice,
  value: slice,
  decimals: v.pipe(digit, v.minValue(0), v.maxValue(4)),
};
type Slice = v.InferOutput<typeof slice>;
const end = (s: Slice) => s.start + s.length;
const fits = (s: Slice) => end(s) <= 12;

/** EAN-13 digits 2..11 carry the data; the product and value slices must fit and not overlap. */
export const mappingInput = v.pipe(
  v.variant("kind", [
    v.strictObject({ ...fields, kind: v.literal("weight"), unit: v.picklist(["g", "kg"]) }),
    v.strictObject({ ...fields, kind: v.literal("price") }),
  ]),
  v.check((m) => fits(m.product) && fits(m.value), "Slices must end by digit 11"),
  v.check(
    (m) => end(m.product) <= m.value.start || end(m.value) <= m.product.start,
    "Product and value digits overlap",
  ),
);
export const mappingPatch = v.partial(
  v.strictObject({
    ...fields,
    kind: v.picklist(["weight", "price"]),
    unit: v.picklist(["g", "kg"]),
  }),
);
export type MappingInput = v.InferOutput<typeof mappingInput>;
