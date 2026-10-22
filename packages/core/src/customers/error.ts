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
      | "ARCHIVED",
    message: string,
  ) {
    super(message);
  }
}
