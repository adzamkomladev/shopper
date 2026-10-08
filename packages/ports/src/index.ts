import * as v from "valibot";
import type { ShopperDatabase, ShopperTransaction } from "@shopper/db-pg";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Db = ShopperDatabase;
export type DbTransaction = ShopperTransaction;
export const jsonSchema: v.GenericSchema<Json> = v.lazy(() =>
  v.union([
    v.null(),
    v.boolean(),
    v.pipe(v.number(), v.finite()),
    v.string(),
    v.array(jsonSchema),
    v.record(v.string(), jsonSchema),
  ]),
);
export const uuidV7Schema = v.pipe(
  v.string(),
  v.uuid(),
  v.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
);
export const MAX_MESSAGE_BYTES = 96 * 1024;
export const retryPolicySchema = v.object({
  maxAttempts: v.pipe(v.number(), v.integer(), v.minValue(1)),
  delayMs: v.pipe(v.number(), v.integer(), v.minValue(0)),
  backoff: v.picklist(["constant", "linear", "exponential"]),
});
export type RetryPolicy = v.InferOutput<typeof retryPolicySchema>;
export interface Envelope {
  id: string;
  orgId: string;
  v: number;
  sequence: string; // Decimal bigint; consumers never rely on delivery order.
  type: string;
  payload: Json;
}
export function messageBody(message: Envelope): string {
  v.parse(
    v.object({
      id: uuidV7Schema,
      orgId: uuidV7Schema,
      v: v.pipe(v.number(), v.integer(), v.minValue(1)),
      sequence: v.pipe(v.string(), v.regex(/^\d+$/)),
      type: v.pipe(v.string(), v.minLength(1)),
      payload: jsonSchema,
    }),
    message,
  );
  const body = JSON.stringify(message);
  if (new TextEncoder().encode(body).byteLength > MAX_MESSAGE_BYTES) {
    throw new RangeError("Message exceeds 96 KB; put the payload in Blobs and send a reference");
  }
  return body;
}
export interface Delivery {
  message: Envelope;
  attempts: number;
  ack(): Promise<void>; // Explicit acknowledgement, never on handler return.
  retry(): Promise<void>; // Apply policy; exhausted messages go to the dead-letter path.
}
export interface Queue {
  readonly policy: RetryPolicy;
  send(message: Envelope): Promise<void>;
  consume(handler: (delivery: Delivery) => Promise<void>): Promise<void>;
}
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
export {
  scopedKey,
  requestCache,
  storedBlobs,
  blobUrlAccess,
  type BlobUrlOptions,
} from "./storage";
export { memoryWorkflow, WorkflowTimeoutError } from "./workflow";
