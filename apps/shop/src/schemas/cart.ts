import * as v from "valibot";

/** One line of the basket: the product and how much, in thousandths of its unit. */
export const cartLine = v.object({
  productId: v.pipe(v.string(), v.uuid()),
  quantityThousandths: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1_000_000)),
});
/** The basket as this browser stores it. */
export const storedCart = v.array(cartLine);
export type CartLine = v.InferOutput<typeof cartLine>;
