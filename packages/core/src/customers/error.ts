export class CustomerError extends Error {
  constructor(
    public code:
      | "NOT_FOUND"
      | "CONFLICT"
      | "BALANCE_NOT_ZERO"
      | "POINTS_NOT_ZERO"
      | "HOLDS_OPEN"
      | "MERGE_SELF"
      | "MERGE_UNAVAILABLE"
      | "MERGED"
      | "ARCHIVED"
      | "CREDIT_LIMIT"
      | "NOT_ELIGIBLE"
      | "NOT_VERIFIED"
      | "LOYALTY_OFF"
      | "POINTS_SHORT"
      | "SAME_CUSTOMER",
    message: string,
    /** Extra fields of the problem body, such as the credit still `available`. */
    public detail: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
