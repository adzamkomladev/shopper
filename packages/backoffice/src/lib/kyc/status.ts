import type { KycStatus } from "../../schemas/kyc";
import type { Segment } from "./types";

/** The queue's three views, each the statuses it gathers; the first is the one shown on arrival. */
export const SEGMENTS: { value: Segment; label: string; statuses: readonly KycStatus[] }[] = [
  { value: "review", label: "Awaiting approval", statuses: ["review"] },
  { value: "open", label: "Open", statuses: ["otp_sent", "id_needed"] },
  { value: "closed", label: "Closed", statuses: ["approved", "rejected", "expired"] },
];

export const STATUS_LABELS: Record<KycStatus, string> = {
  otp_sent: "Waiting for the code",
  id_needed: "Waiting for the ID",
  review: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
};
