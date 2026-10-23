import { assertLinkSecret, hmacHex as hmac, sha256 } from "@shopper/utils";
import { constantTimeEqual } from "../session/http";

export async function createLinkToken(
  secret: string,
  purpose: "registration" | "registration-resend" | "invitation",
  id: string,
) {
  return hmacHex(secret, `shopper:${purpose}:${id.toLowerCase()}`);
}
/** HMAC-SHA-256 of a message under the shared link secret, as lowercase hex. */
export async function hmacHex(secret: string, message: string) {
  assertLinkSecret(secret);
  return hmac(secret, message);
}
export async function linkDigest(token: string) {
  return sha256(token);
}
export async function assertLink(digest: string, token: string, expiresAt: Date, now: number) {
  if (expiresAt.getTime() <= now || !constantTimeEqual(digest, await linkDigest(token)))
    throw new AuthLinkError("This link is invalid or expired", 410);
}
export class AuthLinkError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409 | 410 | 503 = 400,
  ) {
    super(message);
    this.name = "AuthLinkError";
  }
}
