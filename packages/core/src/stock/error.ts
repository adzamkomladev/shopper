export class StockError extends Error {
  constructor(
    public code: "CONFLICT" | "FORBIDDEN" | "INVALID_SESSION" | "INVALID_REFERENCE" | "SCOPE",
    message: string,
  ) {
    super(message);
  }
}
