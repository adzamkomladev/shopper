const formula = /^[=+\-@\t\r]/;
const plainNumber = /^-?\d+(?:\.\d+)?$/;

/** A spreadsheet runs a cell starting with = + - @ tab or CR as a formula; an apostrophe makes it text. Plain numbers stay numbers. */
const defuse = (cell: string) =>
  formula.test(cell) && !plainNumber.test(cell) ? `'${cell}` : cell;
const quote = (cell: string) => (/[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell);

/** RFC 4180 rows joined by newlines, every cell safe to open in a spreadsheet. */
export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map((cell) => quote(defuse(cell))).join(",")).join("\n");
}
