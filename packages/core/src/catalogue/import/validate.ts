import type { ImportError, CleanRow } from "./types";
export type { ImportError, CleanRow } from "./types";
import { fromDecimal, type Money } from "@shopper/money";
import type { BaseUnit, taxClass } from "@shopper/db-pg";

type TaxClass = (typeof taxClass.$inferSelect)["code"];
import type { Column, Headers, SheetRows } from "./parse";

const units = new Set(["each", "kg", "g", "l", "ml"]);
const taxAliases = new Map<string, TaxClass>(
  Object.entries({
    standard: "standard",
    vat: "standard",
    "15%": "standard",
    zero: "zero-rated",
    "zero-rated": "zero-rated",
    "zero rated": "zero-rated",
    "0%": "zero-rated",
    exempt: "exempt",
    none: "exempt",
  } as Record<string, TaxClass>),
);
const flags = new Map<string, boolean>(
  Object.entries({
    "": false,
    yes: true,
    true: true,
    "1": true,
    no: false,
    false: false,
    "0": false,
  }),
);
const maxName = 200;
const maxSku = 64;
const tidy = (value: string) => value.replace(/\s+/g, " ").trim();

/** GS1 mod-10 check digit, shared by EAN-13, EAN-8 and UPC-A. */
function validBarcode(code: string) {
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(code)) return false;
  const sum = code
    .slice(0, -1)
    .split("")
    .reverse()
    .reduce((total, digit, i) => total + Number(digit) * (i % 2 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === Number(code.at(-1));
}

function parsePrice(text: string): Money {
  const marked = text.replace(/GH₵|₵|GHS|\s/gi, "");
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,4})?$/.test(marked))
    throw new TypeError("Not a price with up to 4 decimals (commas only between thousands)");
  const amount = fromDecimal(marked.replaceAll(",", ""));
  if (amount <= 0) throw new RangeError("Price must be above zero");
  return amount;
}

/** Cleans every row and reports each bad cell; a bad row never stops the good ones. */
export function validateRows(sheet: SheetRows, headers: Headers) {
  const good: CleanRow[] = [];
  const errors: ImportError[] = [];
  const skus = new Set<string>();
  const codes = new Set<string>();

  for (const { row, cells } of sheet) {
    const found: ImportError[] = [];
    const fail = (key: Column, message: string) =>
      found.push({ row, column: headers[key] ?? key, value: (cells[key] ?? "").trim(), message });
    const cell = (key: Column) => (cells[key] ?? "").trim();
    const optionalName = (key: Column) => {
      const value = tidy(cell(key));
      if (value.length > maxName) fail(key, `Longer than ${maxName} characters`);
      return value || null;
    };

    const sku = cell("sku");
    if (!sku) fail("sku", "SKU is required");
    else if (sku.length > maxSku) fail("sku", `SKU is longer than ${maxSku} characters`);
    const name = tidy(cell("name"));
    if (!name) fail("name", "Name is required");
    else if (name.length > maxName) fail("name", `Name is longer than ${maxName} characters`);

    const barcodes: CleanRow["barcodes"] = [];
    const rowCodes = new Set<string>();
    const addCode = (code: string, quantityThousandths: number, key: Column) => {
      if (!validBarcode(code)) fail(key, `${code} is not a valid EAN-13, EAN-8 or UPC-A`);
      else if (!rowCodes.has(code)) {
        rowCodes.add(code);
        barcodes.push({ code, quantityThousandths, column: key });
      } else if (key === "packBarcode") fail(key, `${code} is already listed as a barcode`);
    };
    for (const code of cell("barcodes")
      .split(/[;,|\s]+/)
      .filter(Boolean))
      addCode(code, 1000, "barcodes");
    const packCode = cell("packBarcode");
    const packQty = cell("packQty");
    if (packCode || packQty) {
      const qtyOk = /^[1-9]\d{0,5}$/.test(packQty);
      if (!qtyOk) fail("packQty", "Pack Qty must be a whole number above 0");
      if (!packCode) fail("packBarcode", "Pack Qty needs a Pack Barcode");
      else if (qtyOk) addCode(packCode, Number(packQty) * 1000, "packBarcode");
    }

    const unit = cell("unit").toLowerCase() || "each";
    if (!units.has(unit)) fail("unit", `Unit must be one of ${[...units].join(", ")}`);
    // A blank tax class is an error, never a silent "standard": a wrong rate taxes every sale.
    const taxText = cell("taxClass").toLowerCase().replace(/\s+/g, " ");
    const taxClass = headers.taxClass ? taxAliases.get(taxText) : undefined;
    if (headers.taxClass && !taxText)
      fail("taxClass", "Tax class is required (Standard, Zero-rated or Exempt)");
    else if (headers.taxClass && !taxClass)
      fail("taxClass", "Unknown tax class (use Standard, Zero-rated or Exempt)");
    const online = flags.get(cell("online").toLowerCase());
    if (online === undefined) fail("online", "Online must be Yes or No");
    const department = optionalName("department");
    const category = optionalName("category");
    const supplier = optionalName("supplier");
    let amount: Money | undefined;
    try {
      amount = parsePrice(cell("price"));
    } catch (error) {
      if (!(error instanceof TypeError || error instanceof RangeError)) throw error;
      fail("price", error.message);
    }

    if (!found.length) {
      if (skus.has(sku)) fail("sku", `SKU ${sku} appears earlier in the file`);
      for (const { code, column } of barcodes)
        if (codes.has(code)) fail(column, `Barcode ${code} appears earlier in the file`);
    }
    if (found.length) {
      errors.push(...found);
      continue;
    }
    skus.add(sku);
    for (const { code } of barcodes) codes.add(code);
    good.push({
      row,
      sku,
      name,
      barcodes,
      baseUnit: unit as BaseUnit,
      department,
      category,
      supplier,
      taxClass,
      amount: amount!,
      onlineVisible: online!,
    });
  }
  return { good, errors };
}
