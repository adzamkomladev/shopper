import { and, asc, eq, gt, isNotNull, isNull } from "drizzle-orm";
import { GENESIS_HASH, verifyChain } from "@shopper/audit";
import { auditAnchor, auditLog, deviceAudit } from "@shopper/db-pg";
import type { Queryable } from "../types";
import type { StreamVerification } from "./types";

/**
 * Verifies one stream (`org`, or a device id) page by page from its genesis, then holds it to every anchor published
 * for it: a row at an anchor's seq must carry the anchor's hash, and the chain must still reach the last anchor.
 */
export async function verifyStream(
  db: Queryable,
  orgId: string,
  stream: string,
  options = { pageSize: 2000 },
): Promise<StreamVerification> {
  const anchors = await db
    .select({ seq: auditAnchor.chainSeq, hash: auditAnchor.hash })
    .from(auditAnchor)
    .where(and(eq(auditAnchor.orgId, orgId), eq(auditAnchor.stream, stream)))
    .orderBy(asc(auditAnchor.chainSeq));
  // A seq-0 anchor names the empty chain, whose only valid hash is genesis.
  if (anchors.some((anchor) => anchor.seq === 0 && anchor.hash !== GENESIS_HASH))
    return { valid: false, entryId: null, seq: 0, reason: "anchor" };
  const legacy = stream === "org" && (await legacyRow(db, orgId));
  if (legacy) return { valid: false, entryId: legacy.id, seq: null, reason: "legacy-unhashed" };
  let head = { seq: 0, hash: GENESIS_HASH };
  let last: { id: string; chainSeq: number | null } | undefined;
  let count = 0;
  for (;;) {
    const rows = await page(db, orgId, stream, head.seq, options.pageSize);
    const result = await verifyChain(rows, undefined, head);
    if (!result.valid) {
      const bad = rows.find((row) => row.id === result.entryId);
      return {
        valid: false,
        entryId: result.entryId,
        seq: bad?.chainSeq ?? null,
        reason: result.reason,
      };
    }
    // Every anchor is checked, so two days that published different hashes for one seq cannot both pass.
    const bySeq = new Map(rows.map((row) => [row.chainSeq, row]));
    const forged = anchors
      .map((anchor) => bySeq.get(anchor.seq) && { anchor, row: bySeq.get(anchor.seq)! })
      .find((match) => match && match.row.hash !== match.anchor.hash)?.row;
    if (forged) return { valid: false, entryId: forged.id, seq: forged.chainSeq, reason: "anchor" };
    count += rows.length;
    last = rows.at(-1) ?? last;
    head = { seq: last?.chainSeq ?? 0, hash: result.finalHash };
    if (rows.length < options.pageSize) break;
  }
  if ((anchors.at(-1)?.seq ?? 0) > head.seq)
    return {
      valid: false,
      entryId: last?.id ?? null,
      seq: last?.chainSeq ?? null,
      reason: "anchor",
    };
  return { valid: true, count, head: count ? head : null };
}

async function legacyRow(db: Queryable, orgId: string) {
  const [row] = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(and(eq(auditLog.orgId, orgId), isNull(auditLog.chainSeq)))
    .limit(1);
  return row;
}

function page(db: Queryable, orgId: string, stream: string, after: number, limit: number) {
  if (stream === "org")
    return db
      .select()
      .from(auditLog)
      .where(
        and(eq(auditLog.orgId, orgId), isNotNull(auditLog.chainSeq), gt(auditLog.chainSeq, after)),
      )
      .orderBy(asc(auditLog.chainSeq))
      .limit(limit);
  return db
    .select()
    .from(deviceAudit)
    .where(
      and(
        eq(deviceAudit.orgId, orgId),
        eq(deviceAudit.deviceId, stream),
        gt(deviceAudit.chainSeq, after),
      ),
    )
    .orderBy(asc(deviceAudit.chainSeq))
    .limit(limit);
}
