import * as v from "valibot";
import { tillId } from "./fields";

export const draftScope = v.strictObject({
  orgId: tillId,
  deviceId: tillId,
  branchId: tillId,
  cashierId: tillId,
});
const edit = {
  scope: draftScope,
  expectedRevision: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  at: v.date(),
};
const quantity = v.number();

export const addDraftInput = v.pipe(
  v.strictObject({
    ...edit,
    code: v.optional(v.pipe(v.string(), v.minLength(1))),
    productId: v.optional(tillId),
    quantityThousandths: v.optional(quantity),
  }),
  v.check(
    (i) => (i.code === undefined) !== (i.productId === undefined),
    "Give a code or a product",
  ),
);
export const setDraftQuantityInput = v.strictObject({
  ...edit,
  lineId: v.string(),
  quantityThousandths: quantity,
});
export const removeDraftLineInput = v.strictObject({ ...edit, lineId: v.string() });
export const readDraftInput = v.strictObject({ scope: draftScope, at: v.date() });

export type DraftScope = v.InferOutput<typeof draftScope>;
