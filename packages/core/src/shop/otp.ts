import { hmacHex } from "@shopper/utils";

export const LOGIN_TTL_MS = 10 * 60_000;
export const LOGIN_MAX_SENDS = 3;
export const LOGIN_MAX_ATTEMPTS = 5;
/** Logins a phone may open at one shop in an hour: with five guesses each, 25 guesses an hour at most. */
export const LOGINS_PER_HOUR = 5;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;

/**
 * The code for a login's nth send. Derived rather than drawn, so the queue consumer can text it without the code
 * ever being stored or carried in a message, and a redelivered message texts the same code.
 */
export async function loginCode(secret: string, loginId: string, send: number) {
  const hash = await hmacHex(secret, `shopper:shop-code:${loginId}:${send}`);
  return String(Number.parseInt(hash.slice(0, 8), 16) % 1_000_000).padStart(6, "0");
}

/** What the login row keeps of a code: keyed, so six digits cannot be searched out of a database copy. */
export const loginDigest = (secret: string, loginId: string, code: string) =>
  hmacHex(secret, `shopper:shop-otp:${loginId}:${code}`);
