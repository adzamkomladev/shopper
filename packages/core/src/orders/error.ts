/** Why a checkout cannot go ahead; `code` tells the store which part of the form to send the shopper back to. */
export class OrderError extends Error {
  constructor(
    readonly code: "closed" | "slot" | "stock" | "not_found",
    message: string,
    readonly status: 404 | 409 | 422 = code === "not_found" ? 404 : 409,
    readonly products: string[] = [],
  ) {
    super(message);
  }
}
