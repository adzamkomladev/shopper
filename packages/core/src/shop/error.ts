import * as v from "valibot";

/** A shop-account failure with the HTTP status it answers; anything else is a server error. */
export class ShopError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409 | 429,
  ) {
    super(message);
    this.name = "ShopError";
  }
}

/** Valibot's first message as a 400, so a shopper reads what to fix. */
export function parseShop<T extends v.GenericSchema>(schema: T, value: unknown): v.InferOutput<T> {
  const parsed = v.safeParse(schema, value);
  if (!parsed.success) throw new ShopError(parsed.issues[0].message, 400);
  return parsed.output;
}
