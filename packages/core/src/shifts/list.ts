import * as v from "valibot";
import { and, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { branch, device, shift, shiftTender, user, type ShopperDatabase } from "@shopper/db-pg";
import { add, money, type Money } from "@shopper/money";
import { SHIFT_LIST_LIMIT, decodeZReport } from "../schemas/till/shift";

/**
 * Closed shifts of the organisation, newest first, with who closed and approved them. `short` sums the
 * tenders that came up short (≤ 0) and `over` those that came up over (≥ 0), so offsetting tenders never net to zero.
 */
// ponytail: the newest SHIFT_LIST_LIMIT shifts only; add a cursor when a store keeps more on screen.
export async function listShifts(db: ShopperDatabase, orgId: string) {
  const rows = await summaries(db, orgId);
  return { shifts: rows };
}

/** One closed shift with its stored Z (never recomputed) and the names of everyone the Z mentions. */
export async function readShift(db: ShopperDatabase, orgId: string, id: string) {
  const [row] = await summaries(db, orgId, id);
  if (!row) return null;
  const [saved] = await db
    .select({ report: shift.report })
    .from(shift)
    .where(and(eq(shift.orgId, orgId), eq(shift.id, id)));
  const report = decodeZReport(saved!.report);
  const ids = [
    report.openedBy,
    report.closedBy,
    ...(report.approverId ? [report.approverId] : []),
    ...report.cashiers.map((c) => c.userId),
    ...report.movements.map((m) => m.actorId),
  ];
  const people = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(and(eq(user.orgId, orgId), inArray(user.id, [...new Set(ids)])));
  return { ...row, report, names: Object.fromEntries(people.map((p) => [p.id, p.name])) };
}

async function summaries(db: ShopperDatabase, orgId: string, id?: string) {
  const closer = alias(user, "closer");
  const approver = alias(user, "approver");
  const rows = await db
    .select({
      id: shift.id,
      deviceId: shift.deviceId,
      deviceName: device.name,
      branchId: shift.branchId,
      branchName: branch.name,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      closedBy: shift.closedBy,
      closedByName: closer.name,
      approverId: shift.approverId,
      approverName: approver.name,
      expectedCash: shift.expectedCash,
      declaredCash: shift.declaredCash,
    })
    .from(shift)
    .innerJoin(device, and(eq(device.orgId, shift.orgId), eq(device.id, shift.deviceId)))
    .innerJoin(branch, and(eq(branch.orgId, shift.orgId), eq(branch.id, shift.branchId)))
    .innerJoin(closer, and(eq(closer.orgId, shift.orgId), eq(closer.id, shift.closedBy)))
    .leftJoin(approver, and(eq(approver.orgId, shift.orgId), eq(approver.id, shift.approverId)))
    .where(and(eq(shift.orgId, orgId), id ? eq(shift.id, id) : undefined))
    .orderBy(desc(shift.closedAt), desc(shift.id))
    .limit(SHIFT_LIST_LIMIT);
  const tenders = rows.length
    ? await db
        .select({ shiftId: shiftTender.shiftId, variance: shiftTender.variance })
        .from(shiftTender)
        .where(
          and(
            eq(shiftTender.orgId, orgId),
            inArray(
              shiftTender.shiftId,
              rows.map((r) => r.id),
            ),
          ),
        )
    : [];
  return rows.map((row) => ({
    ...row,
    openedAt: row.openedAt.toISOString(),
    closedAt: row.closedAt.toISOString(),
    approverName: row.approverName ?? null,
    short: sumOf(tenders, row.id, (variance) => variance < 0),
    over: sumOf(tenders, row.id, (variance) => variance > 0),
  }));
}

function sumOf(
  tenders: { shiftId: string; variance: Money }[],
  shiftId: string,
  keep: (variance: number) => boolean,
) {
  return tenders
    .filter((t) => t.shiftId === shiftId && keep(t.variance))
    .reduce((sum, t) => add(sum, t.variance), money(0));
}
