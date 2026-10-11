import type { Envelope } from "./messages";
import type { Json, RetryPolicy } from "./schemas/primitives";

export interface Sequencer {
  // Per store, strictly increasing bigint. Gaps are allowed. floor supports archive restore.
  next(orgId: string, storeId: string, floor?: bigint): Promise<bigint>;
}
export interface CacheReader {
  get(orgId: string, key: string): Promise<Json | null>;
}
export interface CacheWriter {
  put(orgId: string, key: string, value: Json, ttlMs: number): Promise<void>;
  delete(orgId: string, key: string): Promise<void>;
}
export interface Cache {
  // Begin one scope per request. Reads after any write fail; cache is never authoritative.
  request(): CacheReader & CacheWriter;
}
export interface Blobs {
  put(orgId: string, key: string, value: Uint8Array): Promise<void>;
  get(orgId: string, key: string): Promise<Uint8Array | null>;
  delete(orgId: string, key: string): Promise<void>;
  signedUrl(orgId: string, key: string, expiresInSeconds: number): Promise<string>;
}
export type WorkflowStatus =
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "compensating"
  | "compensated";
export interface WorkflowCheckpoint {
  instanceId: string;
  businessKey: string; // Must equal instanceId; include tenant identity for non-global keys.
  type: string;
  step: string;
  status: WorkflowStatus;
}
export interface Workflow {
  readonly instanceId: string;
  step<T extends Json>(
    name: string,
    policy: RetryPolicy,
    run: () => Promise<T>,
    compensate?: (output: T) => Promise<void>,
  ): Promise<T>;
  sleep(name: string, durationMs: number): Promise<void>;
  sleepUntil(name: string, instant: Date): Promise<void>;
  waitFor(name: string, type: string, timeoutMs: number): Promise<Json>;
  send(instanceId: string, type: string, payload: Json): Promise<void>;
  compensate(): Promise<void>;
}
// One launcher per workflow kind. Acknowledges the launch only; starting an existing id is a no-op.
export interface WorkflowLauncher {
  start(instanceId: string, params: Json): Promise<void>;
}
export interface UtcCron {
  expression: string;
  timeZone: "UTC";
}
export interface Scheduler {
  // One daily watchdog only. Business schedules use Workflow.sleepUntil.
  watchdog(schedule: UtcCron, restartDeadChains: () => Promise<void>): Promise<void>;
}
export interface Realtime {
  publish(orgId: string, storeId: string, message: Envelope): Promise<void>;
  // One socket per device; push changes with a cursor for reconnection.
  subscribe(
    orgId: string,
    storeId: string,
    deviceId: string,
    cursor: string,
    onMessage: (message: Envelope) => Promise<void>,
  ): Promise<{ close(): Promise<void> }>;
}
