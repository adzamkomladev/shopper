import type { ChainVerification } from "@shopper/audit";

/** A stream's verdict: its length and head when intact, or the first entry that breaks it and why. */
export type StreamVerification =
  | { valid: true; count: number; head: { seq: number; hash: string } | null }
  | {
      valid: false;
      entryId: string | null;
      seq: number | null;
      reason: Extract<ChainVerification, { valid: false }>["reason"];
    };

/** What `POST /sync/audit` answers: the stream's head, or a refusal the till keeps for good. */
export type DeviceAuditOutcome =
  | { accepted: { head: { seq: number; hash: string } }; from?: number }
  | { rejected: { code: string; message: string } };
