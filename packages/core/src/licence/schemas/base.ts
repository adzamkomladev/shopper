import * as v from "valibot";

const iso = v.pipe(v.string(), v.isoTimestamp());

/** `lic/1`: the perpetual, machine-bound licence. `maintenanceUntil` only governs updates. */
export const licence = v.object({
  format: v.literal("lic/1"),
  id: v.pipe(v.string(), v.uuid()),
  org: v.pipe(v.string(), v.uuid()),
  site: v.pipe(v.string(), v.minLength(1)),
  // SHA-256 of the box's /etc/machine-id.
  machine: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
  // The box's Ed25519 public key (base64url), which signs its requests.
  key: v.string(),
  terminals: v.pipe(v.number(), v.integer(), v.minValue(1)),
  issuedAt: iso,
  maintenanceUntil: v.pipe(v.string(), v.isoDate()),
  signature: v.string(),
});
export type Licence = v.InferOutput<typeof licence>;

/** The issuer's word that this licence checked in at `confirmedAt`. */
export const confirmation = v.object({
  licence: v.pipe(v.string(), v.uuid()),
  confirmedAt: iso,
  signature: v.string(),
});
export type Confirmation = v.InferOutput<typeof confirmation>;
