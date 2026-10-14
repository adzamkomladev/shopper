export class TillError extends Error {
  constructor(
    public readonly code:
      | "scope"
      | "permission"
      | "session"
      | "reference"
      | "conflict"
      | "counter"
      | "PRODUCT_UNKNOWN"
      | "PRICE_MISSING"
      | "TAX_RULE_MISSING"
      | "QUANTITY_INVALID"
      | "CHECKSUM_INVALID"
      | "MAPPING_MISSING"
      | "UNIT_INVALID"
      | "AMOUNT_INVALID",
    message: string,
  ) {
    super(message);
    this.name = "TillError";
  }
}
