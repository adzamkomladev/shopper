import * as v from "valibot";
import { saleEvent } from "@shopper/core/schemas";
import type { createQueueStorage } from "./storage";
export const MAX_BYTES = 1_048_576;
export function createBatch(
  queue: Awaited<ReturnType<ReturnType<typeof createQueueStorage>["read"]>>,
  requestId: string,
  protocol: number,
  now: number,
  receiptLastUsed = 0,
) {
  const events: v.InferOutput<typeof saleEvent>[] = [];
  const proofs: Array<{ sessionId: string; proof: string }> = [];
  const blocked: Array<{ localId: string; blockedReason: string }> = [];
  const rows = [];
  for (const row of queue.rows) {
    if (row.blockedReason || row.nextAttemptAt > now) continue;
    const parsed = v.safeParse(saleEvent, row.event);
    const session =
      parsed.success && queue.sessions.find((entry) => entry.id === parsed.output.sale.sessionId);
    if (!parsed.success || !session) {
      blocked.push({
        localId: row.localId,
        blockedReason: "INVALID_LOCAL_EVENT: Restore the original session proof or sale data",
      });
      continue;
    }
    const proof = { sessionId: session.id, proof: session.proof };
    const newProofs = proofs.some((entry) => entry.sessionId === session.id)
      ? proofs
      : [...proofs, proof];
    const body = JSON.stringify({
      requestId,
      protocol,
      receiptLastUsed,
      events: [...events, parsed.output],
      proofs: newProofs,
    });
    if (new TextEncoder().encode(body).byteLength > MAX_BYTES) {
      if (!events.length) {
        blocked.push({
          localId: row.localId,
          blockedReason: "EVENT_TOO_LARGE: Sale exceeds the 1 MiB request size limit",
        });
        continue;
      }
      break;
    }
    events.push(parsed.output);
    rows.push(row);
    if (newProofs !== proofs) proofs.push(proof);
    if (events.length === 200) break;
  }
  return { rows, blocked, body: { requestId, protocol, receiptLastUsed, events, proofs } };
}
