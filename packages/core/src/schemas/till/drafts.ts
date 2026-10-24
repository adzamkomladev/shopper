import * as v from "valibot";
import { tillSession } from "./session";
import { tillId } from "./fields";

export const draftScope = v.strictObject({
  orgId: tillId,
  deviceId: tillId,
  branchId: tillId,
  cashierId: tillId,
});
export const draftEdit = {
  scope: draftScope,
  expectedRevision: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  at: v.date(),
};
const quantity = v.number();

export const addDraftInput = v.pipe(
  v.strictObject({
    ...draftEdit,
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
  ...draftEdit,
  lineId: v.string(),
  quantityThousandths: quantity,
});
export const removeDraftLineInput = v.strictObject({ ...draftEdit, lineId: v.string() });
export const readDraftInput = v.strictObject({ scope: draftScope, at: v.date() });

export type DraftScope = v.InferOutput<typeof draftScope>;

export const editDraftInput = v.strictObject(draftEdit);
export const addDraftTenderInput = v.variant("kind", [
  v.strictObject({
    ...draftEdit,
    kind: v.literal("cash"),
    amount: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  }),
  v.strictObject({
    ...draftEdit,
    kind: v.literal("card"),
    amount: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
    approvalCode: v.pipe(v.string(), v.regex(/^[a-zA-Z0-9]{4,12}$/)),
    last4: v.optional(v.pipe(v.string(), v.regex(/^[0-9]{4}$/))),
  }),
]);
/** An account tender: `id` is the server hold the host already took for it. Points tender `points` worth `amount`. */
const accountTender = {
  ...draftEdit,
  id: tillId,
  amount: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
};
export const accountTenderInput = v.variant("kind", [
  v.strictObject({ ...accountTender, kind: v.literal("credit") }),
  v.strictObject({
    ...accountTender,
    kind: v.literal("loyalty"),
    points: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  }),
]);
export const removeDraftTenderInput = v.strictObject({ ...draftEdit, tenderId: tillId });
export const holdDraftInput = v.strictObject({
  ...draftEdit,
  name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100))),
});
export const resumeDraftInput = v.strictObject({ ...draftEdit, draftId: tillId });

export const discountDraftInput = v.strictObject({
  ...draftEdit,
  session: tillSession,
  lineId: tillId,
  discount: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
});
/** `approverId` is a manager the host already verified by PIN; it is never taken from the UI. */
const approverId = v.optional(tillId);
export const priceDraftInput = v.strictObject({
  ...draftEdit,
  session: tillSession,
  lineId: tillId,
  unitPrice: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  reason: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500)),
  approverId,
});
export const voidDraftInput = v.strictObject({
  ...draftEdit,
  draftId: v.optional(tillId),
  approverId,
  session: tillSession,
  reason: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500)),
});
