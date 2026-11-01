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
