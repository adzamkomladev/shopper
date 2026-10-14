import * as v from "valibot";
import { mappingInput } from "@shopper/core/schemas";
import { ApiError } from "../../api/client";
import { layoutProblem, rangeOf } from "../../lib/catalogue/mappings/digits";

const slice = v.object({ start: v.number(), length: v.number() });
export const mappingView = v.object({
  id: v.string(),
  prefix: v.number(),
  product: slice,
  value: slice,
  kind: v.picklist(["weight", "price"]),
  unit: v.optional(v.picklist(["g", "kg"])),
  decimals: v.number(),
});
export type MappingView = v.InferOutput<typeof mappingView>;
export const mappingList = v.array(mappingView);
export const deletedMapping = v.null();

const whole = (min: number, max: number, message: string) =>
  v.pipe(
    v.string(),
    v.trim(),
    v.regex(/^\d+$/, message),
    v.transform(Number),
    v.minValue(min, message),
    v.maxValue(max, message),
  );

/** Digits are what a person counts on the label: the first printed digit is 1. */
export const mappingFormSchema = v.pipe(
  v.object({
    prefix: whole(20, 29, "Use a number from 20 to 29"),
    kind: v.picklist(["weight", "price"]),
    unit: v.picklist(["g", "kg"]),
    productStart: whole(3, 12, "Use a digit from 3 to 12"),
    productLength: whole(1, 10, "Use a number from 1 to 10"),
    valueStart: whole(3, 12, "Use a digit from 3 to 12"),
    valueLength: whole(1, 10, "Use a number from 1 to 10"),
    decimals: whole(0, 4, "Use a number from 0 to 4"),
  }),
  // Whole-layout checks run once every field is a usable number, and land on the field to fix.
  v.rawCheck(({ dataset, addIssue }) => {
    if (!dataset.typed || dataset.issues) return;
    const m = dataset.value;
    const problem = layoutProblem(
      rangeOf(m.productStart, m.productLength)!,
      rangeOf(m.valueStart, m.valueLength)!,
      m.kind,
    );
    if (!problem) return;
    addIssue({
      message: problem.message,
      path: [
        {
          type: "object",
          origin: "value",
          input: m,
          key: problem.field,
          value: m[problem.field],
        },
      ],
    });
  }),
);
export type MappingValues = v.InferInput<typeof mappingFormSchema>;

/** A common scale label: 2 PPPPP WWWWW C, in kilograms with three decimals. */
export const emptyMapping: MappingValues = {
  prefix: "",
  kind: "weight",
  unit: "kg",
  productStart: "3",
  productLength: "5",
  valueStart: "8",
  valueLength: "5",
  decimals: "3",
};

export const mappingValues = (m: MappingView): MappingValues => ({
  prefix: String(m.prefix),
  kind: m.kind,
  unit: m.unit ?? "kg",
  productStart: String(m.product.start + 1),
  productLength: String(m.product.length),
  valueStart: String(m.value.start + 1),
  valueLength: String(m.value.length),
  decimals: String(m.decimals),
});

/** The API counts digits from 0, so a label's first printed digit is start 0. */
export function toMappingBody(values: MappingValues) {
  const m = v.parse(mappingFormSchema, values);
  const layout = {
    prefix: m.prefix,
    product: { start: m.productStart - 1, length: m.productLength },
    value: { start: m.valueStart - 1, length: m.valueLength },
    decimals: m.decimals,
  };
  return v.parse(
    mappingInput,
    m.kind === "weight" ? { ...layout, kind: m.kind, unit: m.unit } : { ...layout, kind: m.kind },
  );
}

/** What to tell the owner when a write fails; a taken prefix belongs on the Prefix field. */
export function mappingFailure(error: Error, prefix: string) {
  if (error instanceof ApiError && error.status === 409)
    return {
      field: "prefix" as const,
      message: `Prefix ${prefix} already has a layout. Edit that one instead.`,
    };
  if (error instanceof ApiError && error.status === 403)
    return { message: "You don't have permission to change barcode layouts. Ask the shop owner." };
  if (error instanceof ApiError && error.status === 404)
    return { message: "This layout was removed by someone else. Close this and check the list." };
  return { message: error.message };
}
