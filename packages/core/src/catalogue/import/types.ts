import type { columns } from "./parse";
import type { Money } from "@shopper/money";
import type { taxClass } from "@shopper/db-pg";
import type { BaseUnit } from "@shopper/db-pg";

export type ImportInput = {
  fileName: string;
  assetId?: string;
  sha256: string;
  rowsTotal: number;
  rows: CleanRow[];
  errors: ImportError[];
  headers: Headers;
};

export type Column = (typeof columns)[number];
export type Headers = Partial<Record<Column, string>>;
export type SheetRows = { row: number; cells: Partial<Record<Column, string>> }[];

export type Planned = {
  row: CleanRow;
  existingId?: string;
  newBarcodes: CleanRow["barcodes"];
  quantityFixes: CleanRow["barcodes"];
  fieldsChanged: boolean;
  priceNeeded: boolean;
};
export type FieldSet = Record<"unit" | "online" | "tax" | "category" | "supplier", boolean>;

export type Refs = {
  tax: Map<TaxClass, string>;
  categories: Map<string, string>;
  suppliers: Map<string, string>;
};

export type ImportError = { row: number; column: string; value: string; message: string };
export type CleanRow = {
  row: number;
  sku: string;
  name: string;
  barcodes: { code: string; quantityThousandths: number; column: Column }[];
  baseUnit: BaseUnit;
  department: string | null;
  category: string | null;
  supplier: string | null;
  // Undefined only when the file has no Tax Class column; existing products then keep theirs.
  taxClass?: TaxClass;
  amount: Money;
  onlineVisible: boolean;
};

export type TaxClass = (typeof taxClass.$inferSelect)["code"];
