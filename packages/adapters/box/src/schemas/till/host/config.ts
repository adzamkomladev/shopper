import * as v from "valibot";
import { tillReceiptCodes, tillReference, tillSession } from "@shopper/core/schemas";
import { receiptReference } from "@shopper/core/receipts";
import { registerIdentity } from "@shopper/sync/bridge";

export const hostConfiguration = v.pipe(
  v.strictObject({
    sqlitePath: v.pipe(v.string(), v.minLength(1)),
    databaseKey: v.optional(v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/))),
    identity: registerIdentity,
    upstream: v.pipe(v.string(), v.url()),
    deviceToken: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/)),
    session: v.nullable(tillSession),
    references: v.optional(tillReference),
    receiptCodes: v.optional(tillReceiptCodes),
    receiptReference: v.optional(receiptReference),
    origins: v.array(v.pipe(v.string(), v.url())),
    ui: v.optional(v.pipe(v.string(), v.minLength(1))),
    port: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(65535)),
  }),
  // A host serving its own UI allows its own origin (a provisioned register has no other); else one is needed.
  v.check(
    (config) => config.ui !== undefined || config.origins.length > 0,
    "origins needs at least one entry unless the host serves the UI",
  ),
);
export type HostConfiguration = v.InferOutput<typeof hostConfiguration>;
