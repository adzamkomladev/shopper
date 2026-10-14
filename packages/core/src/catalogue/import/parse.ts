import type { Column, Headers, SheetRows } from "./types";
export type { Column, Headers, SheetRows } from "./types";
import * as XLSX from "xlsx";
import { ManagementError } from "../../management";

export const columns = [
  "sku",
  "name",
  "barcodes",
  "packBarcode",
  "packQty",
  "unit",
  "department",
  "category",
  "supplier",
  "taxClass",
  "price",
  "online",
] as const;

/** The header text as written in the file, for the columns the file has. */

const aliases = new Map<string, Column>(
  Object.entries({
    sku: "sku",
    code: "sku",
    name: "name",
    description: "name",
    barcodes: "barcodes",
    barcode: "barcodes",
    packbarcode: "packBarcode",
    packqty: "packQty",
    unit: "unit",
    department: "department",
    category: "category",
    supplier: "supplier",
    taxclass: "taxClass",
    vat: "taxClass",
    sellingprice: "price",
    price: "price",
    online: "online",
  } as Record<string, Column>),
);
const required: [Column, string][] = [
  ["sku", "SKU"],
  ["name", "Name"],
  ["price", "Selling Price"],
];
const headerSearchRows = 10;
const maxRows = 50_000;
const maxColumns = 50;

const cellText = (value: unknown) =>
  typeof value === "string"
    ? value
    : typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : "";
const column = (header: string) => aliases.get(header.toLowerCase().replace(/\s+/g, ""));
function utf8(bytes: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (cause) {
    throw new ManagementError("Save the CSV as UTF-8 and upload it again", 400, { cause });
  }
}
const isBinary = (b: Uint8Array) =>
  (b[0] === 0x50 && b[1] === 0x4b) || (b[0] === 0xd0 && b[1] === 0xcf);

/** Reads CSV or XLSX bytes. Row numbers are the sheet's own, so blank rows never shift them. */
export function parseSheet(bytes: Uint8Array) {
  if (bytes.length === 0) throw new ManagementError("The file is empty", 400);
  // CSV is decoded as UTF-8 (which drops a BOM); raw keeps cells as typed text, so leading
  // zeros survive and numeric XLSX cells arrive as numbers, never as formatted text.
  let book: XLSX.WorkBook;
  try {
    book = isBinary(bytes)
      ? XLSX.read(bytes, { type: "array", raw: true })
      : XLSX.read(utf8(bytes), { type: "string", raw: true });
  } catch (cause) {
    if (cause instanceof ManagementError) throw cause;
    throw new ManagementError("The file is not a readable CSV or XLSX spreadsheet", 400, { cause });
  }
  const sheet = book.Sheets[book.SheetNames[0] ?? ""];
  if (!sheet?.["!ref"]) throw new ManagementError("The first sheet is empty", 400);
  // Checked before sheet_to_json, which allocates a row array for every declared row.
  const { s, e } = XLSX.utils.decode_range(sheet["!ref"]);
  if (e.r - s.r > maxRows || e.c - s.c + 1 > maxColumns)
    throw new ManagementError("The sheet is too large: at most 50,000 rows and 50 columns", 400);
  // Object mode is the only one that reports true sheet row numbers (__rowNum__).
  const width = e.c - s.c + 1;
  const keys = Array.from({ length: width }, (_, i) => String(i));
  const grid = XLSX.utils
    .sheet_to_json<Record<string, unknown> & { __rowNum__: number }>(sheet, {
      header: keys,
      raw: true,
      defval: "",
      blankrows: false,
    })
    .map((o) => ({ row: o.__rowNum__ + 1, line: keys.map((k) => o[k]) }));

  if (!grid.some(({ line }) => line.some((c) => cellText(c).trim())))
    throw new ManagementError("The first sheet is empty", 400);
  const headerAt = grid
    .slice(0, headerSearchRows)
    .findIndex(({ line }) => line.some((c) => column(cellText(c))));
  if (headerAt < 0)
    throw new ManagementError("No header row found: expected SKU, Name and Selling Price", 400);
  const headers: Headers = {};
  const index: Partial<Record<Column, number>> = {};
  grid[headerAt]!.line.forEach((cell, i) => {
    const text = cellText(cell).replace(/^﻿/, "").trim();
    const key = column(text);
    if (!key) return;
    if (index[key] !== undefined)
      throw new ManagementError(`Columns "${headers[key]}" and "${text}" both mean ${key}`, 400);
    index[key] = i;
    headers[key] = text;
  });
  for (const [key, label] of required)
    if (!headers[key]) throw new ManagementError(`Missing required column: ${label}`, 400);

  const rows: SheetRows = [];
  for (const { row, line } of grid.slice(headerAt + 1)) {
    const cells: Partial<Record<Column, string>> = {};
    for (const key of columns) {
      const at = index[key];
      if (at !== undefined) cells[key] = cellText(line[at]);
    }
    if (Object.values(cells).some((c) => c.trim() !== "")) rows.push({ row, cells });
  }
  return { headers, rows };
}
