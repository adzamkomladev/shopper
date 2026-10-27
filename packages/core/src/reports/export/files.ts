import * as XLSX from "xlsx";
import { toDecimal, type Money } from "@shopper/money";
import { toCsv } from "@shopper/utils";
import type { ReportCell, ReportTable } from "../types";

/**
 * The table as CSV: amounts in cedis to four places (exact, so they add up), quantities to three, percentages to
 * two, all written from integers.
 */
export function reportCsv(table: ReportTable) {
  return `${toCsv([table.headers, ...table.rows.map((row) => row.map(text))])}\n`;
}

/** The table as an Excel workbook of one sheet, numbers as numbers with display formats. */
export function reportWorkbook(table: ReportTable) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([table.headers, ...table.rows.map((row) => row.map(cell))]),
    table.name.slice(0, 31),
  );
  return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

function text(cell: ReportCell) {
  if (cell.kind === "text") return cell.value;
  if (cell.value === null) return "";
  if (cell.kind === "money") return toDecimal(cell.value as Money, 4);
  if (cell.kind === "quantity") return scaled(cell.value, 1000, 3);
  if (cell.kind === "bps") return scaled(cell.value, 100, 2);
  return String(cell.value);
}

const formats = { money: "#,##0.00", quantity: "#,##0.###", bps: "0.00%", count: "0" };

function cell(entry: ReportCell): XLSX.CellObject | string {
  if (entry.kind === "text") return entry.value;
  if (entry.value === null) return "";
  // The value is the exact decimal written out, read back once for display; nothing is summed in floats.
  const shown = entry.kind === "bps" ? scaled(entry.value, 10_000, 4) : text(entry);
  return { t: "n", v: Number(shown), z: formats[entry.kind] };
}

/** An integer over `unit` as a decimal string with `places` places (unit = 10^places). */
function scaled(value: number, unit: number, places: number) {
  const magnitude = Math.abs(value);
  const whole = Math.trunc(magnitude / unit);
  const part = String(magnitude % unit).padStart(places, "0");
  return `${value < 0 ? "-" : ""}${whole}.${part}`;
}
