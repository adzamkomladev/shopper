import { toCsv } from "@shopper/utils";
import type { Queryable } from "../types";
import { listAuditDetails } from "./queries";
import type { ScopedAuditFilters } from "./types";

const header = [
  "Time",
  "Device time",
  "Stream",
  "Seq",
  "Actor",
  "Role",
  "Device",
  "Branch",
  "Command",
  "Entity",
  "Entity id",
  "Approver",
  "Reason",
  "Before",
  "After",
  "Hash",
];

/**
 * The filtered log as CSV lines, a page at a time so six years never sit in memory: the header first, then one line
 * per entry, newest first. The Shopper Archive reuses it.
 */
export async function* auditCsv(db: Queryable, orgId: string, filters: ScopedAuditFilters) {
  yield `${toCsv([header])}\n`;
  let cursor = filters.cursor;
  do {
    const page = await listAuditDetails(db, orgId, { ...filters, cursor, limit: 500 });
    if (page.entries.length)
      yield `${toCsv(
        page.entries.map((row) => [
          row.at,
          row.deviceTime ?? "",
          row.streamName ?? row.stream,
          String(row.seq),
          row.actor?.name ?? row.actor?.id ?? "",
          row.role ?? "",
          row.device?.name ?? row.device?.id ?? "",
          row.branch?.name ?? row.branch?.id ?? "",
          row.command,
          row.entity ?? "",
          row.entityId ?? "",
          row.approver?.name ?? row.approver?.id ?? "",
          row.reason ?? "",
          row.before == null ? "" : JSON.stringify(row.before),
          row.after == null ? "" : JSON.stringify(row.after),
          row.hash,
        ]),
      )}\n`;
    cursor = page.next ?? undefined;
  } while (cursor);
}
