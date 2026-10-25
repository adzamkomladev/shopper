import { and, between, desc, eq } from "drizzle-orm";
import { defineCommand, GENESIS_HASH, verifyChain, type AuditEntry } from "@shopper/audit";
import { deviceAudit, type ShopperDatabase, type ShopperTransaction } from "@shopper/db-pg";
import type { UploadPrincipal } from "../sales/types";
import type { DeviceAuditEntry } from "../schemas/audit/device";
import type { DeviceAuditOutcome } from "./types";

type Input = { principal: UploadPrincipal; entries: DeviceAuditEntry[] };
type Head = { seq: number; hash: string };
type Verdict =
  | { kind: "head"; head: Head }
  | { kind: "append"; rows: AuditEntry[]; head: Head }
  | { kind: "rejected"; code: "SCOPE" | "GAP" | "FORK" | "HASH"; message: string };

/**
 * Appends consecutive rows of a till's own chain to its register stream. Rows the server already holds must match
 * byte for byte (a replay answers the head and writes nothing); a batch past a gap answers the head so the till
 * resends from there. Anything forged, forked or foreign is refused for good, and the refusal is audited.
 */
export function ingestDeviceAudit(
  db: ShopperDatabase,
  principal: UploadPrincipal,
  entries: DeviceAuditEntry[],
) {
  return ingest(
    db,
    {
      orgId: principal.orgId,
      deviceId: principal.deviceId,
      branchId: principal.branchId,
      appVersion: entries.at(-1)!.appVersion,
    },
    { principal, entries },
  );
}

const ingest = defineCommand({
  name: "device.audit.upload",
  async replay(tx, ctx, input: Input) {
    const verdict = await assess(tx, ctx.orgId, input);
    if (verdict.kind === "head") return { output: { accepted: { head: verdict.head } } };
  },
  async run(tx, ctx, input): Promise<DeviceAuditOutcome> {
    const verdict = await assess(tx, ctx.orgId, input);
    if (verdict.kind === "rejected")
      return { rejected: { code: verdict.code, message: verdict.message } };
    if (verdict.kind === "head") return { accepted: { head: verdict.head } };
    await tx.insert(deviceAudit).values(
      verdict.rows.map((row) => ({
        ...row,
        streamId: input.principal.deviceId,
        chainSeq: row.chainSeq!,
        prevHash: row.prevHash!,
        hash: row.hash!,
      })),
    );
    return {
      accepted: { head: verdict.head },
      from: verdict.rows[0]!.chainSeq!,
    };
  },
  audit: (input, output) => ({
    stream: input.principal.deviceId,
    ...("rejected" in output
      ? { outcome: "rejected", ...output.rejected }
      : {
          outcome: "accepted",
          from: output.from,
          to: output.accepted.head.seq,
          head: output.accepted.head.hash,
        }),
  }),
  details: (input) => ({ entity: "device", entityId: input.principal.deviceId }),
});

async function assess(tx: ShopperTransaction, orgId: string, input: Input): Promise<Verdict> {
  const entries = [...input.entries].sort((a, b) => a.chainSeq - b.chainSeq);
  const reject = (code: "SCOPE" | "GAP" | "FORK" | "HASH", message: string): Verdict => ({
    kind: "rejected",
    code,
    message,
  });
  if (entries.some((entry) => entry.orgId !== orgId))
    return reject("SCOPE", "Audit entries belong to another organisation");
  if (entries.some((entry, i) => i > 0 && entry.chainSeq !== entries[i - 1]!.chainSeq + 1))
    return reject("GAP", "Audit entries are not consecutive");
  const stream = input.principal.deviceId;
  const head = await streamHead(tx, orgId, stream);
  const held = entries.filter((entry) => entry.chainSeq <= head.seq);
  if (held.length) {
    const stored = await tx
      .select({ seq: deviceAudit.chainSeq, hash: deviceAudit.hash })
      .from(deviceAudit)
      .where(
        and(
          eq(deviceAudit.orgId, orgId),
          eq(deviceAudit.streamId, stream),
          between(deviceAudit.chainSeq, held[0]!.chainSeq, held.at(-1)!.chainSeq),
        ),
      );
    const hashes = new Map(stored.map((row) => [row.seq, row.hash]));
    if (held.some((entry) => hashes.get(entry.chainSeq) !== entry.hash))
      return reject("FORK", "Audit entries differ from the chain already stored");
  }
  const fresh = entries.filter((entry) => entry.chainSeq > head.seq);
  if (!fresh.length || fresh[0]!.chainSeq !== head.seq + 1) return { kind: "head", head };
  const rows = fresh.map((entry): AuditEntry => entry);
  const result = await verifyChain(rows, undefined, head);
  if (!result.valid)
    return result.reason === "previous-hash"
      ? reject("FORK", "Audit entries do not continue the stored chain")
      : reject("HASH", "An audit entry does not match its hash");
  return { kind: "append", rows, head: { seq: fresh.at(-1)!.chainSeq, hash: result.finalHash } };
}

async function streamHead(tx: ShopperTransaction, orgId: string, stream: string): Promise<Head> {
  const [last] = await tx
    .select({ seq: deviceAudit.chainSeq, hash: deviceAudit.hash })
    .from(deviceAudit)
    .where(and(eq(deviceAudit.orgId, orgId), eq(deviceAudit.streamId, stream)))
    .orderBy(desc(deviceAudit.chainSeq))
    .limit(1);
  return last ?? { seq: 0, hash: GENESIS_HASH };
}
