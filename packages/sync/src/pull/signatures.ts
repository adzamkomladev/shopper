import * as v from "valibot";
import type { TillDatabase } from "@shopper/db-sqlite";
import { unsignedLocalReceipts } from "@shopper/core/till";
import { signaturesReply } from "../schemas/pull/snapshot";

/** Receipts per request; the server refuses a larger page. */
const PAGE = 500;

/**
 * Before a snapshot replaces the feed, asks the server for the signatures of every receipt this till still holds as
 * provisional: the feed rows that carried them are skipped. Any failure throws, so the snapshot is not applied and the
 * cursor stays where it was.
 */
export async function skippedSignatures(
  database: TillDatabase,
  orgId: string,
  request: (path: string, body: unknown) => Promise<{ response: Response; raw: string }>,
) {
  const unsigned = await database.read((tx) => unsignedLocalReceipts(tx, orgId));
  const pages = Math.ceil(Math.max(unsigned.saleIds.length, unsigned.refundIds.length) / PAGE);
  const replies = [];
  for (let index = 0; index < pages; index++) {
    const page = (ids: string[]) => ids.slice(index * PAGE, (index + 1) * PAGE);
    const reply = await request("/sync/snapshot/signatures", {
      saleIds: page(unsigned.saleIds),
      refundIds: page(unsigned.refundIds),
    });
    if (!reply.response.ok) throw new Error("Signatures unavailable");
    replies.push(...v.parse(signaturesReply, JSON.parse(reply.raw)).signatures);
  }
  return replies;
}
