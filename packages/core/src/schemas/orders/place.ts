import * as v from "valibot";
import { shopPhone } from "../../shop/schemas/signin";
import { cartLine } from "../storefront/cart";

const id = v.pipe(v.string(), v.uuid(), v.toLowerCase());
const required = (max: number, message: string) =>
  v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty(message),
    v.maxLength(max, `Keep it under ${max} characters`),
  );

/** Where a delivery goes; the same fields as a saved shop address, without its label. */
export const deliveryAddress = v.object({
  line1: required(120, "Enter the street or house"),
  area: required(80, "Enter the area"),
  city: required(80, "Enter the town or city"),
  landmark: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.maxLength(120),
      v.transform((text) => text || null),
    ),
    "",
  ),
});

/**
 * A guest checkout. `key` is the browser's random key for this checkout: sending it again returns the same order, and
 * it reads the order back afterwards.
 */
export const placeOrderInput = v.pipe(
  v.object({
    key: id,
    branch: id,
    lines: v.pipe(v.array(cartLine), v.minLength(1, "Your cart is empty"), v.maxLength(100)),
    fulfilment: v.picklist(["pickup", "delivery"]),
    slot: v.pipe(
      v.string(),
      v.isoTimestamp(),
      v.transform((at) => new Date(at)),
    ),
    name: required(80, "Enter your name"),
    phone: shopPhone,
    address: v.optional(deliveryAddress),
  }),
  v.forward(
    v.check(
      (input) => input.fulfilment === "pickup" || input.address !== undefined,
      "Enter where we should deliver",
    ),
    ["address"],
  ),
);
export type PlaceOrderInput = v.InferOutput<typeof placeOrderInput>;
