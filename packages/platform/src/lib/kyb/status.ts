import type { KybStatus } from "../../schemas/types";

export const STATUS_LABELS: Record<KybStatus, string> = {
  draft: "Draft",
  submitted: "Checking",
  checks_failed: "Checks failed",
  in_review: "In review",
  approved: "Approved",
  rejected: "Not approved",
  expired: "Lapsed",
};

/** The queue's tabs, in the order a reviewer works them. */
export const QUEUE_TABS = [
  "in_review",
  "checks_failed",
  "approved",
  "expired",
  "rejected",
] as const;

export const DOCUMENT_LABELS: Record<string, string> = {
  registration_certificate: "Registration certificate",
  tin_certificate: "TIN certificate",
};

export const CHECK_LABELS: Record<string, string> = {
  tin: "TIN format",
  directors: "Directors",
  ghana_card: "Ghana Card numbers",
  card_expiry: "Expiry dates",
  documents: "Documents verified",
  settlement_bank: "Payout bank",
};

export const statusVariant = (status: KybStatus) =>
  status === "in_review"
    ? ("secondary" as const)
    : status === "checks_failed" || status === "expired" || status === "rejected"
      ? ("destructive" as const)
      : ("outline" as const);
