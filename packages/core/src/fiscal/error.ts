export class FiscalError extends Error {
  constructor(
    public code: "NOT_FOUND" | "CONFLICT",
    message: string,
  ) {
    super(message);
  }
}
