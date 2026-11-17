import type { DayTotals, ReconciliationReport } from "../types";
import { DAY_FIGURES } from "./report";

const none = { rows: 0, checksum: "" };
const nothing = Object.fromEntries(DAY_FIGURES.map((f) => [f, "0"])) as DayTotals;

/**
 * The cloud's report set against the box's: every table and every day either side holds, each ok only when both
 * sides agree exactly. The move is verified only when all of them are.
 */
export function compareReports(cloud: ReconciliationReport, box: ReconciliationReport) {
  const tables = [...new Set([...Object.keys(cloud.tables), ...Object.keys(box.tables)])]
    .sort()
    .map((table) => {
      const sides = { cloud: cloud.tables[table] ?? none, box: box.tables[table] ?? none };
      return {
        table,
        ...sides,
        ok: sides.cloud.rows === sides.box.rows && sides.cloud.checksum === sides.box.checksum,
      };
    });
  const days = [...new Set([...Object.keys(cloud.days), ...Object.keys(box.days)])]
    .sort()
    .map((day) => {
      const sides = { cloud: cloud.days[day] ?? nothing, box: box.days[day] ?? nothing };
      return {
        day,
        ...sides,
        ok: DAY_FIGURES.every((f) => BigInt(sides.cloud[f]) === BigInt(sides.box[f])),
      };
    });
  return {
    ok: tables.every((row) => row.ok) && days.every((row) => row.ok),
    tables,
    days,
  };
}
