export class StockError extends Error {
  constructor(
    public code:
      | "CONFLICT"
      | "FORBIDDEN"
      | "INVALID_SESSION"
      | "INVALID_REFERENCE"
      | "NOT_FOUND"
      | "SUPERSEDED",
    message: string,
  ) {
    super(message);
  }
}
