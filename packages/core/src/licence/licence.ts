import * as v from "valibot";
import { sign, verify } from "./keys";
import {
  confirmation as confirmationSchema,
  licence as licenceSchema,
  type Licence,
} from "./schemas/base";
import type { LicenceStatus } from "./types";

const DAY = 86_400_000;
/** Days without a check-in before the portal warns, and before it turns read-only. Tills never lock. */
export const GRACE_AFTER_DAYS = 30;
export const LOCK_AFTER_DAYS = 60;

/** The issuer signs a licence (`tooling/licence/issue.ts`). */
export async function issueLicence(
  issuerKey: string,
  fields: Omit<Licence, "format" | "signature">,
) {
  const unsigned = { format: "lic/1" as const, ...fields };
  return { ...unsigned, signature: await sign(issuerKey, licenceMessage(unsigned)) };
}

/** The issuer confirms a check-in: the box keeps this as proof it was genuine at `at`. */
export async function confirmLicence(issuerKey: string, licenceId: string, at: Date) {
  const confirmedAt = at.toISOString();
  return {
    licence: licenceId,
    confirmedAt,
    signature: await sign(issuerKey, confirmMessage(licenceId, confirmedAt)),
  };
}

/** Where a box stands: genuine for this machine, and how long since the issuer last confirmed it. */
export async function licenceStatus(input: {
  issuer: string;
  machine: string;
  licence: unknown;
  confirmation?: unknown;
  now: Date;
}): Promise<LicenceStatus> {
  if (input.licence === undefined) return { state: "locked", reason: "missing" };
  const parsed = v.safeParse(licenceSchema, input.licence);
  if (!parsed.success) return { state: "locked", reason: "unreadable" };
  const licence = parsed.output;
  if (!(await verify(input.issuer, licenceMessage(licence), licence.signature)))
    return { state: "locked", reason: "forged" };
  if (licence.machine !== input.machine) return { state: "locked", reason: "machine", licence };
  const checkedInAt =
    (await confirmedAt(input.issuer, licence, input.confirmation)) ?? licence.issuedAt;
  const since = input.now.getTime() - Date.parse(checkedInAt);
  const locksAt = new Date(Date.parse(checkedInAt) + LOCK_AFTER_DAYS * DAY).toISOString();
  if (since >= LOCK_AFTER_DAYS * DAY)
    return { state: "locked", reason: "expired", licence, checkedInAt, locksAt };
  const state = since >= GRACE_AFTER_DAYS * DAY ? "grace" : "valid";
  return { state, licence, checkedInAt, locksAt };
}

/** The confirmed time when the confirmation is the issuer's, for this licence, and later than its issue. */
async function confirmedAt(issuer: string, licence: Licence, value: unknown) {
  const parsed = v.safeParse(confirmationSchema, value);
  if (!parsed.success || parsed.output.licence !== licence.id) return undefined;
  const confirmation = parsed.output;
  if (
    !(await verify(
      issuer,
      confirmMessage(confirmation.licence, confirmation.confirmedAt),
      confirmation.signature,
    ))
  )
    return undefined;
  return confirmation.confirmedAt > licence.issuedAt ? confirmation.confirmedAt : undefined;
}

// Fixed field order: the signature covers exactly these values.
export const licenceMessage = (l: Omit<Licence, "signature">) =>
  JSON.stringify([
    l.format,
    l.id,
    l.org,
    l.site,
    l.machine,
    l.key,
    l.terminals,
    l.issuedAt,
    l.maintenanceUntil,
  ]);
const confirmMessage = (licenceId: string, at: string) =>
  JSON.stringify(["confirm", licenceId, at]);
