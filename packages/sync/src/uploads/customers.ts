import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { retryDue } from "../push/backoff";
import { markCustomerAccepted, markCustomerFailed, markCustomerRejected } from "@shopper/core/till";
import { customerUpload, hostSession } from "@shopper/db-sqlite";
import { createDocumentUploadWorker } from "./documents";
import type { StockUploadOptions } from "./types";

/** Uploads customers made and edited on this till, oldest first (`POST /sync/customers`). */
export function createCustomerUploadWorker(options: StockUploadOptions) {
  const { orgId, deviceId } = options.config;
  return createDocumentUploadWorker(options, {
    label: "Customer",
    path: "/sync/customers",
    pending: (tx, force, now) =>
      tx
        .select({ row: customerUpload, proof: hostSession.proof })
        .from(customerUpload)
        .innerJoin(hostSession, eq(hostSession.id, customerUpload.sessionId))
        .where(
          and(
            eq(customerUpload.orgId, orgId),
            eq(customerUpload.deviceId, deviceId),
            isNull(customerUpload.acceptedAt),
            isNull(customerUpload.blockedCode),
            force ? undefined : retryDue(customerUpload.nextAttemptAt, now),
          ),
        )
        // An edit follows the create it edits; ids made in one millisecond are not ordered, rowids are.
        .orderBy(asc(sql`${customerUpload}.rowid`)),
    body: (row, proof) => ({ requestId: row.id, proof, customer: row.payload }),
    accept: markCustomerAccepted,
    reject: markCustomerRejected,
    fail: markCustomerFailed,
  });
}
