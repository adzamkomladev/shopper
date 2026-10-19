// Helpers for the blind-close suites, all acting as `clerk` (refunds.ts: shift.write and report.read), at fixed times
// on the trading day of cash.ts (declare 17:30, close 18:00).
//   declareNow(db, { counts?, card?, momo? }, who?) -> declareShift result { variances, threshold, approvalRequired }
//   declareCash(db, cash, over?)                    -> declares `cash` as the fewest notes and coins
//   closeNow(db, { approverId? }, who?)             -> closeShift result: the Z report
//   sellSome(db)                                    -> a cash and a card sale on the open shift (figures below)
//   denominate(amount)                              -> the denomination map that sums to `amount`
//   bystander, auditor                              -> sessions with their own ids: no shift.write / only shift.read
import { v7 } from "uuid";
import { closeShift, declareShift } from "@shopper/core/till";
import type { TillDatabase } from "@shopper/db-sqlite";
import { config } from "./basket";
import { hour, sellTenders } from "./cash";
import { clerk } from "./refunds";
import { faces, shiftRows } from "./shifts";

export const declareAt = new Date(hour("17:30"));
export const closeAt = new Date(hour("18:00"));
export const bystander = { ...clerk, id: v7(), permissions: ["sale.create", "report.read"] };
export const auditor = { ...clerk, id: v7(), permissions: ["shift.read"] };

export function denominate(amount: number) {
  const counts: Record<string, number> = {};
  let rest = amount;
  for (const face of faces) {
    const count = Math.floor(rest / face);
    if (count) counts[face] = count;
    rest -= count * face;
  }
  return counts;
}

export const declareNow = (
  db: TillDatabase,
  input: Record<string, unknown> = {},
  who: unknown = clerk,
) => declareShift(db, config, who, { at: declareAt, counts: {}, card: 0, momo: 0, ...input });
export const declareCash = (db: TillDatabase, cash: number, over: Record<string, unknown> = {}) =>
  declareNow(db, { counts: denominate(cash), ...over });
export const closeNow = (
  db: TillDatabase,
  input: Record<string, unknown> = {},
  who: unknown = clerk,
) => closeShift(db, config, who, { at: closeAt, ...input });

/**
 * On the default GHS 200 float: 3 units for 36 000 paid with GHS 5.00 (14 000 change) and 2 units for 24 000 on card.
 * Expected cash 2 000 000 + 36 000 = 2 036 000, card 24 000, MoMo 0.
 */
export async function sellSome(db: TillDatabase) {
  await sellTenders(db, hour("09:00"), 3_000, [{ kind: "cash", amount: 50_000 }]);
  await sellTenders(db, hour("09:30"), 2_000, [{ kind: "card", amount: 24_000 }]);
}

export const theShift = async (db: TillDatabase) => (await shiftRows(db))[0]!;
