import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import { markShiftAccepted, markShiftFailed, markShiftRejected } from "@shopper/core/till";
import { hostSession, shift } from "@shopper/db-sqlite";
import { createDocumentUploadWorker } from "./documents";
import type { StockUploadOptions } from "./types";

/** Uploads each closed shift's Z once (`POST /sync/shifts`); open and counted shifts stay on the till. */
export function createShiftUploadWorker(options: StockUploadOptions) {
  const { orgId, deviceId } = options.config;
  return createDocumentUploadWorker(options, {
    label: "Shift",
    path: "/sync/shifts",
    pending: (tx, force, now) =>
      tx
        .select({ row: shift, proof: hostSession.proof })
        .from(shift)
        .innerJoin(hostSession, eq(hostSession.id, shift.closedSessionId))
        .where(
          and(
            eq(shift.orgId, orgId),
            eq(shift.deviceId, deviceId),
            eq(shift.status, "closed"),
            isNull(shift.acceptedAt),
            isNull(shift.blockedCode),
            force ? undefined : or(isNull(shift.nextAttemptAt), lte(shift.nextAttemptAt, now)),
          ),
        )
        .orderBy(asc(shift.id)),
    body: (row, proof) => ({
      requestId: row.id,
      proof,
      shift: {
        v: 1,
        type: "shift.closed",
        shift: { orgId: row.orgId, sessionId: row.closedSessionId, report: row.report },
      },
    }),
    accept: markShiftAccepted,
    reject: markShiftRejected,
    fail: markShiftFailed,
  });
}
