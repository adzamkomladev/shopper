import type { OfflineSession } from "@shopper/core/schemas";

/**
 * What a register sends to act under a cashier session: its proof, its server session's signed grant (which a box
 * restored from an older backup records the session from) and, for an offline session, what the server needs to
 * adopt it under its parent first. Every upload and live request sends it, so the first to reach the server records
 * the session, whichever it is.
 */
export function sessionCredential(session: {
  proof: string;
  parentSessionId?: string | null;
  grant?: string | null;
  issuedAt: string;
  expiresAt: string;
  permissions: string[];
}): { proof: string; grant?: string; offline?: OfflineSession } {
  const grant = session.grant ? { grant: session.grant } : {};
  if (!session.parentSessionId) return { proof: session.proof, ...grant };
  return {
    proof: session.proof,
    ...grant,
    offline: {
      parentSessionId: session.parentSessionId,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt,
      permissions: session.permissions,
    },
  };
}
