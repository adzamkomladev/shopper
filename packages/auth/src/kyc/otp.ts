import { hmacHex } from "../links/tokens";

export const OTP_TTL_MS = 10 * 60_000;
export const OTP_MAX_SENDS = 3;
export const OTP_MAX_ATTEMPTS = 5;
export const DECISION_WINDOW_MS = 7 * 24 * 60 * 60_000;

/**
 * The code for a case's nth send. It is derived, not drawn and stored, so a retried send repeats the same
 * code without the code ever being kept anywhere.
 */
export async function otpCode(secret: string, caseId: string, send: number) {
  const hash = await hmacHex(secret, `shopper:kyc-code:${caseId}:${send}`);
  return String(Number.parseInt(hash.slice(0, 8), 16) % 1_000_000).padStart(6, "0");
}

/** What the case row keeps of a code: keyed, so six digits cannot be searched out of a database copy. */
export const otpDigest = (secret: string, caseId: string, code: string) =>
  hmacHex(secret, `shopper:kyc-otp:${caseId}:${code}`);
