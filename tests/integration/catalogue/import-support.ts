// Helpers for the spreadsheet import suites: uploads, hand-built sheets, row counts.
import { createHash } from "node:crypto";
import { expect } from "vite-plus/test";
import { count, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { type SheetRow } from "../../../tooling/lib/catalogue-fixture";
import {
  api,
  cookies,
  context,
  db,
  allAuditRows,
  call,
  unique,
  type ProductDetail,
} from "./support";

export type ImportError = { row: number; column: string; value: unknown; message: string };
export type ImportResult = {
  id?: string;
  dryRun: boolean;
  rowsTotal: number;
  rowsOk: number;
  rowsFailed: number;
  created: number;
  updated: number;
  unchanged: number;
  pricesAdded?: number;
  errors: ImportError[];
};

export const sha256 = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");

/** POST a file to the import route as one of the seeded roles. */
export function upload(
  bytes: Uint8Array | string,
  fileName = "catalogue.csv",
  { role = "superadmin", dryRun = false } = {},
) {
  const form = new FormData();
  form.set("file", new File([bytes as BlobPart], fileName));
  return api.request(`/catalogue/imports${dryRun ? "?dryRun=1" : ""}`, {
    method: "POST",
    headers: { cookie: cookies.get(role)! },
    body: form,
  });
}

/** Upload and require 201, so a missing route fails here with its status rather than later on a shape. */
export async function importOk(bytes: Uint8Array | string, fileName = "catalogue.csv") {
  const response = await upload(bytes, fileName);
  expect(response.status, "POST /catalogue/imports").toBe(201);
  return (await response.json()) as ImportResult;
}

/** A CSV with exactly the headers given, quoting cells that need it. */
export const csv = (headers: string[], rows: (string | number)[][]) =>
  [headers, ...rows]
    .map((line) =>
      line
        .map((cell) =>
          /[",\n]/.test(String(cell)) ? `"${String(cell).replace(/"/g, '""')}"` : cell,
        )
        .join(","),
    )
    .join("\n");

let sequence = 0;
/** A valid EAN-13 that no other helper hands out. */
export function ean13() {
  const body = `590${String(++sequence).padStart(9, "0")}`;
  const sum = body
    .split("")
    .reduce((total, digit, i) => total + Number(digit) * (i % 2 ? 3 : 1), 0);
  return `${body}${(10 - (sum % 10)) % 10}`;
}

/** Clean, unique sheet rows: every fifth one has a 12-pack barcode and every third is weighed. */
export function sheetRows(count: number, tag = unique("IMP")): SheetRow[] {
  return Array.from({ length: count }, (_, i) => ({
    SKU: `${tag}-${i + 1}`,
    Name: `${tag} Product ${i + 1}`,
    Barcodes: ean13(),
    "Pack Barcode": i % 5 === 0 ? ean13() : "",
    "Pack Qty": i % 5 === 0 ? 12 : "",
    Unit: i % 3 === 0 ? "kg" : "each",
    Department: "Groceries",
    Category: `Cat ${i % 4}`,
    Supplier: `Supplier ${i % 3}`,
    "Tax Class": ["Standard", "Zero-rated", "Exempt"][i % 3],
    "Selling Price": `${5 + i}.50`,
    Online: i % 2 ? "Yes" : "No",
  }));
}

type Counted =
  | typeof schema.product
  | typeof schema.productBarcode
  | typeof schema.price
  | typeof schema.category
  | typeof schema.supplier
  | typeof schema.productImport;

const orgRows = (table: Counted) =>
  db
    .select({ n: count() })
    .from(table)
    .where(eq(table.orgId, context.orgId))
    .then(([row]) => row!.n);

/** Row counts of everything an import may write, to prove a dry run touched nothing. */
export async function footprint() {
  const tables = [
    schema.product,
    schema.productBarcode,
    schema.price,
    schema.category,
    schema.supplier,
    schema.productImport,
  ];
  return [...(await Promise.all(tables.map(orgRows))), (await allAuditRows()).length];
}

export const productRow = async (sku: string) =>
  (await db.select().from(schema.product).where(eq(schema.product.sku, sku)))[0];

export async function detail(sku: string) {
  const page = (await (await call(`/products?q=${encodeURIComponent(sku)}`)).json()) as {
    items: { id: string; sku: string }[];
  };
  const found = page.items.find((item) => item.sku === sku);
  if (!found) return undefined;
  return (await (await call(`/products/${found.id}`)).json()) as ProductDetail;
}
