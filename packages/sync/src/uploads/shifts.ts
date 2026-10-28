import { and, asc, eq, isNull } from "drizzle-orm";
import { retryDue } from "../push/backoff";
import { decodeZReport } from "@shopper/core/schemas";
import { markShiftAccepted, markShiftFailed, markShiftRejected } from "@shopper/core/till";
import { hostSession, shift } from "@shopper/db-sqlite";
import { createDocumentUploadWorker, uploadSession } from "./documents";
import type { StockUploadOptions } from "./types";

/** Uploads each closed shift's Z once (`POST /sync/shifts`); open and counted shifts stay on the till. */
export function createShiftUploadWorker(options: StockUploadOptions) {
  const { orgId, deviceId } = options.config;
  return createDocumentUploadWorker(options, {
    label: "Shift",
    path: "/sync/shifts",
    pending: (tx, force, now) =>
      tx
        .select({ row: shift, session: uploadSession })
        .from(shift)
        .innerJoin(hostSession, eq(hostSession.id, shift.closedSessionId))
        .where(
          and(
            eq(shift.orgId, orgId),
            eq(shift.deviceId, deviceId),
            eq(shift.status, "closed"),
            isNull(shift.acceptedAt),
            isNull(shift.blockedCode),
            force ? undefined : retryDue(shift.nextAttemptAt, now),
          ),
        )
        .orderBy(asc(shift.id)),
    body: (row) => ({
      requestId: row.id,
      shift: {
        v: 2,
        type: "shift.closed",
        // A Z stored before the account lines uploads them as zero.
        shift: {
          orgId: row.orgId,
          sessionId: row.closedSessionId,
          report: decodeZReport(row.report),
        },
      },
    }),
    accept: markShiftAccepted,
    reject: markShiftRejected,
    fail: markShiftFailed,
  });
}
