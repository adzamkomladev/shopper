import type { AuditEntry, ChainVerification } from "./types";
export type { AuditEntry, ChainVerification } from "./types";
import { sha256 } from "@shopper/utils";

export const GENESIS_HASH = "0".repeat(64);

// Reject unsupported values rather than silently dropping them from the signed entry.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (
    typeof value === "object" &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new TypeError("Audit values must be finite JSON data");
}
const SECRET =
  /(^|_)(pin|passwords?|secrets?|tokens?|credentials?|authorization|cookies?|api_key|private_key|signing_key|access_key|session_key|otp|id_number|card_number)(_|$)/i;
const PERSONAL = /(^|_)(phones?|msisdn|mobile|whatsapp|momo_number|tin|ghana_card)(_|$)/i;
// The log can never be rewritten: a phone, TIN or Ghana Card goes in as its last four only, alone or in a list.
const mask = (value: unknown): unknown =>
  typeof value === "string"
    ? "•".repeat(Math.max(value.length - 4, 0)) + value.slice(-4)
    : Array.isArray(value)
      ? value.map(mask)
      : redact(value);
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        const name = key.replace(/([a-z])([A-Z])/g, "$1_$2");
        if (SECRET.test(name)) return [key, "[REDACTED]"];
        return [key, PERSONAL.test(name) ? mask(item) : redact(item)];
      }),
    );
  }
  return value;
}
export async function hashEntry(entry: AuditEntry): Promise<string> {
  // Fixed v1 projection: adding a database column cannot invalidate existing hashes.
  const body = canonicalJson({
    format: 1,
    id: entry.id,
    orgId: entry.orgId,
    actorId: entry.actorId,
    role: entry.role,
    deviceId: entry.deviceId,
    branchId: entry.branchId,
    approverId: entry.approverId,
    reason: entry.reason,
    entity: entry.entity,
    entityId: entry.entityId,
    before: entry.before,
    after: entry.after,
    appVersion: entry.appVersion,
    command: entry.command,
    payload: entry.payload,
    chainSeq: entry.chainSeq,
    prevHash: entry.prevHash,
    createdAt: entry.createdAt.toISOString(),
    deviceTime: entry.deviceTime?.toISOString() ?? null,
  });
  return sha256(body);
}

// Supply rows ordered by chainSeq (legacy rows first). An external anchor detects tail truncation. `start` continues
// a chain verified page by page: the last good row's sequence and hash.
export async function verifyChain(
  entries: readonly AuditEntry[],
  expectedFinalHash?: string,
  start = { seq: 0, hash: GENESIS_HASH },
): Promise<ChainVerification> {
  let previous = start.hash;
  let sequence = start.seq;
  const orgId = entries[0]?.orgId;
  for (const entry of entries) {
    const fail = (
      reason: Exclude<ChainVerification, { valid: true }>["reason"],
    ): ChainVerification => ({ valid: false, entryId: entry.id, reason });
    if (entry.orgId !== orgId) return fail("tenant");
    if (entry.hash === null || entry.prevHash === null || entry.chainSeq === null)
      return fail("legacy-unhashed");
    if (entry.chainSeq !== ++sequence) return fail("sequence");
    if (entry.prevHash !== previous) return fail("previous-hash");
    if ((await hashEntry(entry)) !== entry.hash) return fail("hash");
    previous = entry.hash;
  }
  if (expectedFinalHash !== undefined && previous !== expectedFinalHash) {
    return { valid: false, entryId: entries.at(-1)?.id ?? "", reason: "anchor" };
  }
  return { valid: true, count: entries.length, finalHash: previous };
}
