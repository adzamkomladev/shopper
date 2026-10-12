import { writeFileSync } from "node:fs";
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import {
  generateCatalogue,
  toSpreadsheet,
  type SheetRow,
} from "../../tooling/lib/catalogue-fixture";

export type BadRow = { row: number; column: "Name" | "Selling Price" | "Barcodes" };

/** A valid EAN-13 that differs per run and per row (8 digits of clock, 2 of row index). */
function ean13(stamp: number, index: number) {
  const body = `59${String(stamp % 1e8).padStart(8, "0")}${String(index).padStart(2, "0")}`;
  const sum = body
    .split("")
    .reduce((total, digit, i) => total + Number(digit) * (i % 2 ? 3 : 1), 0);
  return `${body}${(10 - (sum % 10)) % 10}`;
}

/** `count` clean rows whose SKU and Name carry `tag`, so a search for it finds exactly this file. */
export function cleanRows(tag: string, count: number): SheetRow[] {
  const stamp = Date.now();
  return generateCatalogue(count).map((row, i) => ({
    ...row,
    SKU: `${tag}-${i + 1}`,
    Name: `${tag} ${row.Name}`,
    Barcodes: ean13(stamp, i),
    "Pack Barcode": "",
    "Pack Qty": "",
  }));
}

/**
 * Three good rows (sheet rows 2 to 4) then three bad ones: row 5 has no Name, row 6 a price that
 * is not a number, row 7 reuses row 2's barcode. The sheet has its header on row 1.
 */
export function messyRows(tag: string): { rows: SheetRow[]; bad: BadRow[] } {
  const rows = cleanRows(tag, 6);
  rows[3].Name = "";
  rows[4]["Selling Price"] = "abc";
  rows[5].Barcodes = rows[0].Barcodes;
  return {
    rows,
    bad: [
      { row: 5, column: "Name" },
      { row: 6, column: "Selling Price" },
      { row: 7, column: "Barcodes" },
    ],
  };
}

/** Writes the rows as a spreadsheet under the test's output folder and returns its path. */
export function writeSheet(info: TestInfo, rows: SheetRow[], format: "csv" | "xlsx") {
  const path = info.outputPath(`catalogue.${format}`);
  writeFileSync(path, toSpreadsheet(rows, format));
  return path;
}

export async function openImports(page: Page) {
  await page.goto("/imports");
  await expect(page.getByRole("heading", { name: /import/i, level: 1 })).toBeVisible();
}

/** Chooses the file in the Spreadsheet input and runs the dry run. */
export async function checkFile(page: Page, path: string) {
  await page.getByLabel("Spreadsheet").setInputFiles(path);
  await page.getByRole("button", { name: "Check file" }).click();
}

export const errorsTable = (page: Page) => page.getByRole("table");

/** The errors-table row for a sheet row and column, which must also say what is wrong. */
export function errorRow(page: Page, { row, column }: BadRow): Locator {
  return errorsTable(page)
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: String(row), exact: true }) })
    .filter({ has: page.getByRole("cell", { name: column, exact: true }) });
}

/** The counts line of the report, for example 3 rows ready to import and 3 rows with errors. */
export async function expectCounts(page: Page, ok: number, failed: number) {
  const timeout = 20_000;
  await expect(page.getByText(new RegExp(`\\b${ok} rows? ready to import\\b`, "i"))).toBeVisible({
    timeout,
  });
  await expect(page.getByText(new RegExp(`\\b${failed} rows? with errors?\\b`, "i"))).toBeVisible();
}

/** Lists products by the run's tag, the way the Products search box does. */
export async function openTagged(page: Page, tag: string) {
  await page.goto(`/products?q=${tag}`);
  await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
  return page.getByRole("row").filter({ hasText: tag });
}

export async function screenshotAt(page: Page, info: TestInfo, name: string) {
  for (const [width, height] of [
    [1366, 768],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    const path = info.outputPath(`${name}-${width}x${height}.png`);
    await page.screenshot({ path, fullPage: true });
    await info.attach(`${name}-${width}x${height}`, { path, contentType: "image/png" });
  }
}
