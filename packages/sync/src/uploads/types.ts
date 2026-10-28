import type { TillDatabase, TillSqlite } from "@shopper/db-sqlite";
import type { PushOptions } from "../push/types";
import type { sessionCredential } from "../session";

export type ReceiptUploadOptions = Pick<
  PushOptions,
  "database" | "config" | "now" | "random" | "timeoutMs"
> & { onChange?: () => void };

export type StockUploadOptions = ReceiptUploadOptions;

export type Context = { orgId: string; deviceId: string; appVersion: string };
export type Row = { id: string; attempts: number };
export type UploadSession = Parameters<typeof sessionCredential>[0];

/** What distinguishes one kind of queued document: where it is stored, sent and marked. */
export type DocumentUpload<T extends Row> = {
  label: string;
  path: string;
  /** Oldest first, not accepted, not blocked and (unless `force`) past their backoff deadline. */
  pending: (
    tx: TillSqlite,
    force: boolean,
    now: number,
  ) => Promise<{ row: T; session: UploadSession }[]>;
  /** The document; the session credential is added to it. */
  body: (row: T) => Record<string, unknown>;
  accept: (
    db: TillDatabase,
    context: Context,
    input: { id: string; result: Record<string, unknown>; at: Date },
  ) => Promise<unknown>;
  reject: (
    db: TillDatabase,
    context: Context,
    input: { id: string; code: string; reason: string },
  ) => Promise<unknown>;
  fail: (
    db: TillDatabase,
    context: Context,
    input: { id: string; nextAttemptAt: number; reason: string },
  ) => Promise<unknown>;
};
