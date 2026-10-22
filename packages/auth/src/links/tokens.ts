import { hmacHex, sha256 } from "@shopper/utils";
import { constantTimeEqual } from "../session/http";

export async function createLinkToken(
  secret: string,
  purpose: "registration" | "registration-resend" | "invitation",
  id: string,
) {
  if (secret.length < 32) throw new Error("Link secret must be at least 32 characters");
  return hmacHex(secret, `shopper:${purpose}:${id.toLowerCase()}`);
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
