import type { OfflineSession } from "@shopper/core/schemas";

/**
 * What a register sends to act under a cashier session: its proof and, for an offline session, what the server
 * needs to adopt it under its parent first. Every upload and live request sends it, so the first to reach the
 * server records the session, whichever it is.
 */
export function sessionCredential(session: {
  proof: string;
  parentSessionId?: string | null;
  issuedAt: string;
  expiresAt: string;
  permissions: string[];
}): { proof: string; offline?: OfflineSession } {
  if (!session.parentSessionId) return { proof: session.proof };
  return {
    proof: session.proof,
    offline: {
      parentSessionId: session.parentSessionId,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt,
      permissions: session.permissions,
    },
  };
}
