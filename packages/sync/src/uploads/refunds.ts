import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import { markRefundAccepted, markRefundFailed, markRefundRejected } from "@shopper/core/till";
import { hostSession, refund } from "@shopper/db-sqlite";
import { createDocumentUploadWorker } from "./documents";
import type { StockUploadOptions } from "./types";

/** Uploads refunds made here (`POST /sync/refunds`); refunds of other registers' sales are born accepted. */
export function createRefundUploadWorker(options: StockUploadOptions) {
  const { orgId, deviceId } = options.config;
  return createDocumentUploadWorker(options, {
    label: "Refund",
    path: "/sync/refunds",
    pending: (tx, force, now) =>
      tx
        .select({ row: refund, proof: hostSession.proof })
        .from(refund)
        .innerJoin(hostSession, eq(hostSession.id, refund.sessionId))
        .where(
          and(
            eq(refund.orgId, orgId),
            eq(refund.deviceId, deviceId),
            isNull(refund.acceptedAt),
            isNull(refund.blockedCode),
            force ? undefined : or(isNull(refund.nextAttemptAt), lte(refund.nextAttemptAt, now)),
          ),
        )
        .orderBy(asc(refund.id)),
    body: (row, proof) => ({ requestId: row.id, proof, refund: row.payload }),
    accept: markRefundAccepted,
    reject: markRefundRejected,
    fail: markRefundFailed,
  });
}
