/** A ledger failure with the HTTP status it answers; anything else is a server error. */
export class LedgerError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 422,
  ) {
    super(message);
    this.name = "LedgerError";
  }
}
