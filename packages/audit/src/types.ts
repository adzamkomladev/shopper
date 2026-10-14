import type { workflowRun } from "@shopper/db-pg";
import type { auditLog } from "@shopper/db-pg";

export interface CommandContext {
  orgId: string;
  onStoreChanged?: (storeId: string, sequence: string) => Promise<void>;
  actorId?: string;
  role?: string;
  deviceId?: string;
  branchId?: string;
  approverId?: string;
  reason?: string;
  deviceTime?: Date;
  appVersion: string;
}
export interface AuditDetails {
  entity?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}
export interface WorkflowCheckpoint {
  instanceId: string;
  businessKey: string;
  type: string;
  step: string;
  status: typeof workflowRun.$inferSelect.status;
}

export type AuditEntry = typeof auditLog.$inferSelect;
export type ChainVerification =
  | { valid: true; count: number; finalHash: string }
  | {
      valid: false;
      entryId: string;
      reason: "legacy-unhashed" | "sequence" | "previous-hash" | "hash" | "tenant" | "anchor";
    };
