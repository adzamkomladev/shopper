import * as v from "valibot";
import { tillReceiptCodes, tillReference, tillSession } from "@shopper/core/schemas";
import { receiptReference } from "@shopper/core/receipts";
import { registerIdentity } from "@shopper/sync/bridge";

/** What every till has from its install: where it keeps its data, the API it talks to, and how it is reached. */
const install = {
  sqlitePath: v.pipe(v.string(), v.minLength(1)),
  databaseKey: v.optional(v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/))),
  upstream: v.pipe(v.string(), v.url()),
  origins: v.array(v.pipe(v.string(), v.url())),
  ui: v.optional(v.pipe(v.string(), v.minLength(1))),
  port: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(65535)),
};
// A host serving its own UI allows its own origin (a provisioned register has no other); else one is needed.
const reachable = <T extends { ui?: string; origins: string[] }>() =>
  v.check<T, string>(
    (config) => config.ui !== undefined || config.origins.length > 0,
    "origins needs at least one entry unless the host serves the UI",
  );

export const hostConfiguration = v.pipe(
  v.strictObject({
    ...install,
    identity: registerIdentity,
    deviceToken: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/)),
    session: v.nullable(tillSession),
    references: v.optional(tillReference),
    receiptCodes: v.optional(tillReceiptCodes),
    receiptReference: v.optional(receiptReference),
  }),
  reachable(),
);
export type HostConfiguration = v.InferOutput<typeof hostConfiguration>;

/** A till before enrolment: only its install. Enrolling adds the identity, device token and receipt codes. */
export const enrolmentConfiguration = v.pipe(v.strictObject(install), reachable());

/** The org lookup the API answers for a shop code. */
export const shopLookup = v.object({ id: v.string(), name: v.pipe(v.string(), v.minLength(1)) });
