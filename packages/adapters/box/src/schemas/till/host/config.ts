import * as v from "valibot";
import { tillReceiptCodes, tillReference, tillSession } from "@shopper/core/schemas";
import { receiptReference } from "@shopper/core/receipts";
import { registerIdentity } from "@shopper/sync/bridge";

/** What every till has from its install: where it keeps its data, the API it talks to, and how it is reached. */
const install = {
  sqlitePath: v.pipe(v.string(), v.minLength(1)),
  databaseKey: v.optional(v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/))),
  /** Development and tests only: keep the database unencrypted. A packaged register always has a key. */
  plaintext: v.optional(v.literal(true)),
  upstream: v.pipe(v.string(), v.url()),
  /** The box CA pinned at first run. Electron hands it to the host as NODE_EXTRA_CA_CERTS; the host never reads it. */
  ca: v.optional(v.pipe(v.string(), v.minLength(1))),
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

// Sales and staff PIN hashes sit in this file, so a register never falls back to plain SQLite by omission.
const keyed = <T extends { databaseKey?: string; plaintext?: true }>() =>
  v.check<T, string>(
    (config) => config.databaseKey !== undefined || config.plaintext === true,
    "databaseKey is required (plaintext: true is for development and tests only)",
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
  keyed(),
);
export type HostConfiguration = v.InferOutput<typeof hostConfiguration>;

/** A till before enrolment: only its install. Enrolling adds the identity, device token and receipt codes. */
export const enrolmentConfiguration = v.pipe(v.strictObject(install), reachable());

/** Electron's answer to a box address typed on the enrol screen: refused with why, or pinned (it then restarts). */
export const serverAnswer = v.variant("type", [
  v.object({ type: v.literal("server-refused"), message: v.pipe(v.string(), v.maxLength(500)) }),
  v.object({ type: v.literal("server-changed") }),
]);

/** The org lookup the API answers for a shop code. */
export const shopLookup = v.object({ id: v.string(), name: v.pipe(v.string(), v.minLength(1)) });
