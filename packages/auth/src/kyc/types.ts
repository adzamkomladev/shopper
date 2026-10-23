import type { kycIdTypes, kycCase, ShopperDatabase } from "@shopper/db-pg";
import type { WorkflowLauncher } from "@shopper/ports";

export type KycIdType = (typeof kycIdTypes)[number];
export type KycCaseRow = typeof kycCase.$inferSelect;

export type KycErrorCode =
  | "NOT_FOUND"
  | "CASE_OPEN"
  | "WRONG_STEP"
  | "EXPIRED"
  | "RESEND_LIMIT"
  | "OTP_PENDING"
  | "OTP_INVALID"
  | "OTP_LOCKED"
  | "ID_REQUIRED"
  | "ID_NOT_ACCEPTED"
  | "ID_NOT_SIGHTED"
  | "LIMIT_REQUIRED"
  | "UNAVAILABLE";

/**
 * How a command that may only be refused after it committed ended. A lapsed or wrongly answered case still
 * persists (the expiry, the attempt count), so the service turns the outcome into the error afterwards.
 */
export type KycOutcome = "ok" | "wrong" | "locked" | "expired";

export interface KycOptions {
  database: ShopperDatabase;
  /** Absent on a host without the KYC workflow or its SMS: the case routes then answer 503. */
  launcher?: WorkflowLauncher;
  linkSecret?: string;
}
