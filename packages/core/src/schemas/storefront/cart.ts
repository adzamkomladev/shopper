import * as v from "valibot";

const id = v.pipe(v.string(), v.uuid(), v.toLowerCase());

/** One basket line: a product and how much, in thousandths of its base unit (1 each = 1000). */
export const cartLine = v.object({
  productId: id,
  quantityThousandths: v.pipe(v.number(), v.safeInteger(), v.minValue(1), v.maxValue(1_000_000)),
});

/** A basket to price at a branch (default: the first). Delivery adds the branch's fee when it delivers. */
export const cartQuery = v.object({
  branch: v.optional(id),
  lines: v.pipe(v.array(cartLine), v.minLength(1), v.maxLength(100)),
  fulfilment: v.optional(v.picklist(["pickup", "delivery"]), "pickup"),
});
export type CartQuery = v.InferInput<typeof cartQuery>;
