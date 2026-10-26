import type { AuditFilters } from "../schemas/audit/filters";
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

type Named = { id: string; name: string | null } | null;

/** One row of the merged log as the viewer lists it. `stream` is `org` or the uploading register's id. */
export type AuditItem = {
  id: string;
  stream: string;
  streamName: string | null;
  seq: number;
  at: string;
  deviceTime: string | null;
  command: string;
  entity: string | null;
  entityId: string | null;
  role: string | null;
  reason: string | null;
  actor: Named;
  approver: Named;
  device: Named;
  branch: Named;
};

export type AuditDetail = AuditItem & {
  before: unknown;
  after: unknown;
  payload: Record<string, unknown>;
  hash: string;
  prevHash: string;
  appVersion: string;
};

/** Filters plus `scope`: a branch-scoped caller's branches, never read from a query string. */
export type ScopedAuditFilters = AuditFilters & { scope?: string[] };
