import { and, asc, eq, isNull } from "drizzle-orm";
import { retryDue } from "../push/backoff";
import {
  markStockDocumentAccepted,
  markStockDocumentFailed,
  markStockDocumentRejected,
} from "@shopper/core/till";
import { hostSession, stockDocument } from "@shopper/db-sqlite";
import { createDocumentUploadWorker, uploadSession } from "./documents";
import type { StockUploadOptions } from "./types";

/** Uploads queued stock counts and receipts (`POST /sync/stock`). */
export function createStockUploadWorker(options: StockUploadOptions) {
  const { orgId, deviceId } = options.config;
  return createDocumentUploadWorker(options, {
    label: "Stock",
    path: "/sync/stock",
    pending: (tx, force, now) =>
      tx
        .select({ row: stockDocument, session: uploadSession })
        .from(stockDocument)
        .innerJoin(hostSession, eq(hostSession.id, stockDocument.sessionId))
        .where(
          and(
            eq(stockDocument.orgId, orgId),
            eq(stockDocument.deviceId, deviceId),
            isNull(stockDocument.acceptedAt),
            isNull(stockDocument.blockedCode),
            force ? undefined : retryDue(stockDocument.nextAttemptAt, now),
          ),
        )
        .orderBy(asc(stockDocument.id)),
    body: (row) => ({ requestId: row.id, document: row.payload }),
    accept: markStockDocumentAccepted,
    reject: markStockDocumentRejected,
    fail: markStockDocumentFailed,
  });
}
