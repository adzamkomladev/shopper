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
export const stockLowPayload = v.strictObject({ alertId: uuidV7Schema });
