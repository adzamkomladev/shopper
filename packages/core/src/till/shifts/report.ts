import * as v from "valibot";
import { defineCommand } from "@shopper/audit/sqlite";
import { money } from "@shopper/money";
import type { TillDatabase, TillSqlite } from "@shopper/db-sqlite";
import { shiftReport, type ShiftReport } from "../../schemas/till/shift";
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
  return db.read((tx) => xReport(tx, prepared));
}

/** Prints the X report: the same figures, with an audit row saying who printed what. */
export async function printShiftReport(
  db: TillDatabase,
  rawConfig: unknown,
  rawSession: unknown,
  raw: unknown,
) {
  const { at } = v.parse(shiftReportInput, raw);
  const prepared = await prepare(db, rawConfig, rawSession, at, "report.read");
  return print(db, contextOf(prepared), prepared);
}

const print = defineCommand({
  name: "shift.print",
  run: (tx, _context, prepared: Prepared) => xReport(tx, prepared),
  audit: (_input, output) => ({ kind: output.kind, expectedCash: output.cash.expected }),
  details: (_input, output) => ({ entity: "shift", entityId: output.shiftId }),
});

async function xReport(tx: TillSqlite, { config, time }: Prepared) {
  const found = await findShift(tx, config);
  if (!found) throw new TillError("SHIFT_REQUIRED", "Register closed. Open a shift");
  return buildShiftReport(await readShiftParts(tx, found), time);
}

/** The shift's figures at `at`, from its stored parts. */
export function buildShiftReport(parts: ShiftParts, at: Date): ShiftReport {
  const { shift, movements } = parts;
  const totals = shiftTotals({
    float: money(shift.float),
    sales: parts.sales,
    refunds: parts.refunds,
    drops: movements.filter((m) => m.kind === "drop").map((m) => money(m.amount)),
  });
  return v.parse(shiftReport, {
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
