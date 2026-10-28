/** Why the host refused; anything it did not name reads as the server being unreachable. */
export type EnrolFailure = "SHOP_NOT_FOUND" | "ENROL_REFUSED" | "ENROL_LOCKED" | "OFFLINE";
export type EnrolOutcome =
  | { kind: "enrolled"; shopName: string; registerName: string }
  | { kind: "refused"; code: EnrolFailure };
