import * as v from "valibot";
import { defineCommand } from "@shopper/audit/sqlite";
import { money } from "@shopper/money";
import { and, eq } from "drizzle-orm";
import { shift, type TillDatabase, type TillSqlite } from "@shopper/db-sqlite";
import { xReport, zReport, type XReport, type ZReport } from "../../schemas/till/shift";
import { shiftReportInput } from "../../schemas/till/shifts";
import { shiftTotals } from "../../shifts/totals";
import { contextOf, prepare } from "./commands";
import { findShift, readShiftParts } from "./queries";
import type { Prepared, ShiftParts } from "./types";
import { TillError } from "../error";

/** The X report of the register's shift; reading it writes nothing. Needs `report.read`, so a cashier counts blind. */
export async function readShiftReport(
  db: TillDatabase,
  rawConfig: unknown,
  rawSession: unknown,
  raw: unknown,
) {
  const { at } = v.parse(shiftReportInput, raw);
  const prepared = await prepare(db, rawConfig, rawSession, at, "report.read");
  return db.read((tx) => currentX(tx, prepared));
}

/**
 * Prints the X report, or with `shiftId` reprints that closed shift's stored Z (never recomputed), with an audit
 * row saying who printed what.
 */
export async function printShiftReport(
  db: TillDatabase,
  rawConfig: unknown,
  rawSession: unknown,
  raw: unknown,
) {
  const { at, shiftId } = v.parse(shiftReportInput, raw);
  const permission = shiftId ? "shift.read" : "report.read";
  const prepared = await prepare(db, rawConfig, rawSession, at, permission);
  return print(db, contextOf(prepared), { ...prepared, shiftId });
}

const print = defineCommand({
  name: "shift.print",
  run: (
    tx,
    _context,
    input: Prepared & { shiftId: string | undefined },
  ): Promise<XReport | ZReport> =>
    input.shiftId ? storedZ(tx, input.config, input.shiftId) : currentX(tx, input),
  audit: (_input, output) => ({ kind: output.kind, expectedCash: output.cash.expected }),
  details: (_input, output) => ({ entity: "shift", entityId: output.shiftId }),
});

async function currentX(tx: TillSqlite, { config, time }: Prepared) {
  const found = await findShift(tx, config);
  if (!found) throw new TillError("SHIFT_REQUIRED", "Register closed. Open a shift");
  return buildShiftReport(await readShiftParts(tx, found), time);
}

async function storedZ(tx: TillSqlite, config: Prepared["config"], shiftId: string) {
  const [found] = await tx
    .select({ report: shift.report })
    .from(shift)
    .where(
      and(
        eq(shift.orgId, config.orgId),
        eq(shift.deviceId, config.deviceId),
        eq(shift.id, shiftId),
      ),
    );
  if (!found?.report)
    throw new TillError("SHIFT_REQUIRED", "That shift is not closed on this register");
  return v.parse(zReport, found.report);
}

/** The shift's figures at `at`, from its stored parts. */
export function buildShiftReport(parts: ShiftParts, at: Date): XReport {
  const { shift, movements } = parts;
  const totals = shiftTotals({
    float: money(shift.float),
    sales: parts.sales,
    refunds: parts.refunds,
    drops: movements.filter((m) => m.kind === "drop").map((m) => money(m.amount)),
    accountPayments: parts.payments.map((p) => ({ method: p.method, amount: money(p.amount) })),
  });
  return v.parse(xReport, {
    kind: "x",
    shiftId: shift.id,
    storeId: shift.storeId,
    branchId: shift.branchId,
    deviceId: shift.deviceId,
    registerName: parts.registerName,
    openedAt: shift.openedAt,
    openedBy: shift.openedBy,
    at: at.toISOString(),
    ...totals,
    movements: movements.map(({ kind, amount, reason, actorId, at }) => ({
      kind,
      amount,
      reason,
      actorId,
      at,
    })),
    cashiers: parts.cashiers,
  });
}
