/** A shop-account failure with the HTTP status it answers; anything else is a server error. */
export class ShopError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 404 | 409,
  ) {
    super(message);
    this.name = "ShopError";
  }
}
