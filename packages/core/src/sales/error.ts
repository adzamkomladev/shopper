export class SaleError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
