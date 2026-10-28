import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { retryDue } from "../push/backoff";
import {
  markAccountPaymentAccepted,
  markAccountPaymentFailed,
  markAccountPaymentRejected,
} from "@shopper/core/till";
import { accountPayment, hostSession } from "@shopper/db-sqlite";
import { createDocumentUploadWorker } from "./documents";
import type { StockUploadOptions } from "./types";

// The server must know the customer first: a payment for one made on this till waits for that upload.
const customerKnown = sql`NOT EXISTS (SELECT 1 FROM customer_upload
  WHERE customer_upload.org_id = account_payment.org_id AND customer_upload.customer_id = account_payment.customer_id
    AND customer_upload.accepted_at IS NULL AND customer_upload.blocked_code IS NULL)`;

/** Uploads the payments taken at this drawer, oldest first (`POST /sync/accounts/payments`). */
export function createAccountPaymentUploadWorker(options: StockUploadOptions) {
  const { orgId, deviceId } = options.config;
  return createDocumentUploadWorker(options, {
    label: "Account payment",
    path: "/sync/accounts/payments",
    pending: (tx, force, now) =>
      tx
        .select({ row: accountPayment, proof: hostSession.proof })
        .from(accountPayment)
        .innerJoin(hostSession, eq(hostSession.id, accountPayment.sessionId))
        .where(
          and(
            eq(accountPayment.orgId, orgId),
            eq(accountPayment.deviceId, deviceId),
            isNull(accountPayment.acceptedAt),
            isNull(accountPayment.blockedCode),
            customerKnown,
            force ? undefined : retryDue(accountPayment.nextAttemptAt, now),
          ),
        )
        .orderBy(asc(sql`${accountPayment}.rowid`)),
    body: (row, proof) => ({ requestId: row.id, proof, payment: row.payload }),
    accept: markAccountPaymentAccepted,
    reject: markAccountPaymentRejected,
    fail: markAccountPaymentFailed,
  });
}
