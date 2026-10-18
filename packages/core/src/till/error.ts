export class TillError extends Error {
  constructor(
    public readonly code:
      | "TENDER_OVERPAID"
      | "TENDER_INSUFFICIENT"
      | "TENDER_UNKNOWN"
      | "SALE_UNKNOWN"
      | "PAYMENT_UNAVAILABLE"
      | "PAYMENT_INVALID"
      | "PAYMENT_UNCONFIRMED"
      | "DRAFT_UNKNOWN"
      | "DRAFT_BUSY"
      | "DISCOUNT_INVALID"
      | "OVERRIDE_INVALID"
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
      | "AMOUNT_INVALID"
      | "REVISION_STALE"
      | "PRINTER_UNCONFIGURED"
      | "PRINTER_OFFLINE"
      | "LINE_UNKNOWN"
      | "INVALID_CREDENTIALS"
      | "SIGN_IN_LOCKED"
      | "OFFLINE_UNAVAILABLE"
      | "DEVICE_REJECTED"
      | "SIGN_IN_UNAVAILABLE"
      | "APPROVAL_REQUIRED"
      | "APPROVAL_FORBIDDEN"
      | "APPROVAL_OFFLINE"
      | "APPROVAL_LOCKED"
      | "APPROVAL_INVALID",
    message: string,
  ) {
    super(message);
    this.name = "TillError";
  }
}
