import { and, asc, eq, isNull } from "drizzle-orm";
import { retryDue } from "../push/backoff";
import { markRefundAccepted, markRefundFailed, markRefundRejected } from "@shopper/core/till";
import { hostSession, refund } from "@shopper/db-sqlite";
import { createDocumentUploadWorker, uploadSession } from "./documents";
import type { StockUploadOptions } from "./types";

/** Uploads refunds made here (`POST /sync/refunds`); refunds of other registers' sales are born accepted. */
export function createRefundUploadWorker(options: StockUploadOptions) {
  const { orgId, deviceId } = options.config;
  return createDocumentUploadWorker(options, {
    label: "Refund",
    path: "/sync/refunds",
    pending: (tx, force, now) =>
      tx
        .select({ row: refund, session: uploadSession })
        .from(refund)
        .innerJoin(hostSession, eq(hostSession.id, refund.sessionId))
        .where(
          and(
            eq(refund.orgId, orgId),
            eq(refund.deviceId, deviceId),
            isNull(refund.acceptedAt),
            isNull(refund.blockedCode),
            force ? undefined : retryDue(refund.nextAttemptAt, now),
          ),
        )
        .orderBy(asc(refund.id)),
    body: (row) => ({ requestId: row.id, refund: row.payload }),
    accept: markRefundAccepted,
    reject: markRefundRejected,
    fail: markRefundFailed,
  });
}
