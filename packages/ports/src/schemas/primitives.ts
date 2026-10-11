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
// A store sequence: a non-negative PG bigint as decimal text (at most 19 digits).
export const sequenceSchema = v.pipe(v.string(), v.regex(/^\d{1,19}$/));
// Cloudflare's instance id rule; the box enforces it too so ids work on both engines.
export const workflowInstanceIdSchema = v.pipe(
  v.string(),
  v.maxLength(100),
  v.regex(/^[a-zA-Z0-9_][a-zA-Z0-9_-]*$/),
);
export const retryPolicySchema = v.object({
  maxAttempts: v.pipe(v.number(), v.integer(), v.minValue(1)),
  delayMs: v.pipe(v.number(), v.integer(), v.minValue(0)),
  backoff: v.picklist(["constant", "linear", "exponential"]),
});
export type RetryPolicy = v.InferOutput<typeof retryPolicySchema>;
