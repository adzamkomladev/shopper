import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

const quantity = v.pipe(v.number(), v.safeInteger(), v.minValue(0));

/** What the picker reports for one line of an order: how much was found, and a substitute for the rest. */
export const pickInput = v.object({
  id: uuidV7Schema,
  lineId: uuidV7Schema,
  pickedThousandths: quantity,
  substitute: v.optional(
    v.object({ productId: uuidV7Schema, quantityThousandths: v.pipe(quantity, v.minValue(1)) }),
  ),
});
