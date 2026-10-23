import { ApiError } from "../../api/client";

// What to do about each way the API can refuse to archive, restore or merge a customer.
const NEXT: Record<string, string> = {
  BALANCE_NOT_ZERO: "Settle what they owe, or return their deposit, first.",
  POINTS_NOT_ZERO: "Let them spend their points first.",
  HOLDS_OPEN: "Wait for the open hold on their account to finish.",
  MERGED: "Merged customers stay merged.",
  MERGE_UNAVAILABLE: "Restore the archived one first, or pick another customer.",
};

/** The API's reason for a refusal, followed by what to do next. Anything else reads as the error itself. */
export function refusal(error: Error) {
  const next = error instanceof ApiError && error.code ? NEXT[error.code] : undefined;
  return next ? `${error.message}. ${next}` : error.message;
}
