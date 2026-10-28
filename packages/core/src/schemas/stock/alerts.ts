import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { quantity } from "./document";

const id = v.pipe(
  uuidV7Schema,
  v.transform((value) => value.toLowerCase()),
);

/** Sets a product's reorder level at a branch; null removes it. */
export const reorderInput = v.strictObject({
  branchId: id,
  productId: id,
  levelThousandths: v.nullable(quantity(0)),
});
export type ReorderInput = v.InferOutput<typeof reorderInput>;

/** The notification payload: the consumer reads everything else from the alert row. */
// `kind` names the alert's revision; messages queued before it existed carry only the id.
export const stockLowPayload = v.strictObject({
  alertId: uuidV7Schema,
  kind: v.optional(v.picklist(["low", "negative"])),
});

/** What the queue carries for a raised alert; the consumer reads everything else from the row. */
export const stockAlertMessage = v.looseObject({
  type: v.picklist(["stock.low", "stock.negative"]),
  v: v.literal(1),
  orgId: uuidV7Schema,
  payload: stockLowPayload,
});
