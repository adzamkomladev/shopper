import * as XLSX from "xlsx";

export const catalogueHeaders = [
  "SKU",
  "Name",
  "Barcodes",
  "Pack Barcode",
  "Pack Qty",
  "Unit",
  "Department",
  "Category",
  "Supplier",
  "Tax Class",
  "Selling Price",
  "Online",
] as const;

export type SheetRow = Record<(typeof catalogueHeaders)[number], string | number>;

export function generateCatalogue(count: number, seed = 1): SheetRow[] {
  if (!Number.isSafeInteger(count) || count < 0 || count > 333333333) {
    throw new RangeError("Catalogue count must be an integer between 0 and 333333333");
  }
  const random = mulberry32(seed);
  let barcodeSequence = 0;
  const nextBarcode = () => ean13(`603${String(++barcodeSequence).padStart(9, "0")}`);
  return Array.from({ length: count }, (_, index) => {
    const weighed = random() < 0.05;
    const choices = weighed ? produce : products;
    const [brand, sizes, department, category, taxClass] =
      choices[Math.floor(random() * choices.length)];
    const sizeOptions = sizes.split("|");
    const size = sizeOptions[Math.floor(random() * sizeOptions.length)];
    const barcodes = [nextBarcode()];
    if (random() < 0.25) barcodes.push(nextBarcode());
    const pack = !weighed && random() < 0.105;
    const cents = Math.round(150 * (95000 / 150) ** (random() ** 1.5));
    return {
      SKU: `SKU-${String(index + 1).padStart(6, "0")}`,
      Name: `${brand} ${size} (${String(index + 1).padStart(6, "0")})`,
      Barcodes: barcodes.join(";"),
      "Pack Barcode": pack ? nextBarcode() : "",
      "Pack Qty": pack ? [6, 12, 24][Math.floor(random() * 3)] : "",
      Unit: weighed ? "kg" : "each",
      Department: department,
      Category: category,
      Supplier: suppliers[Math.floor(random() * suppliers.length)],
      "Tax Class": taxClass,
      "Selling Price": `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`,
      Online: random() < 0.8 ? "Yes" : "No",
    };
  });
}

export function messUp(
  rows: SheetRow[],
  seed = 1,
): {
  rows: SheetRow[];
  bad: { row: number; column: string }[];
} {
  const copy = rows.map((row) => ({ ...row }));
  const random = mulberry32(seed);
  const bad: { row: number; column: string }[] = [];
  if (copy.length === 0) return { rows: copy, bad };
  const candidates = Array.from({ length: Math.max(1, copy.length - 1) }, (_, i) =>
    copy.length === 1 ? 0 : i + 1,
  );
  const badCount = Math.max(1, Math.round(copy.length * 0.01));
  for (let i = 0; i < badCount; i++) {
    const selected = i + Math.floor(random() * (candidates.length - i));
    [candidates[i], candidates[selected]] = [candidates[selected], candidates[i]];
  }
  const badIndices = candidates.slice(0, badCount).sort((a, b) => a - b);
  const selected = new Set(badIndices);
  for (const [index, row] of copy.entries()) {
    if (index === 0 || selected.has(index) || random() >= 0.05) continue;
    switch (Math.floor(random() * 4)) {
      case 0:
        row.Name = `  ${row.Name}  `;
        break;
      case 1:
        row["Selling Price"] = random() < 0.5 ? `GH₵ ${row["Selling Price"]}` : " 1,250.00 ";
        break;
      case 2:
        row.Unit = row.Unit === "kg" ? "KG" : "Each";
        break;
      case 3:
        row["Tax Class"] =
          row["Tax Class"] === "Standard"
            ? random() < 0.5
              ? "VAT"
              : "15%"
            : row["Tax Class"] === "Zero-rated"
              ? "zero"
              : "none";
        break;
    }
  }
  for (const [defect, index] of badIndices.entries()) {
    const row = copy[index];
    let column: (typeof catalogueHeaders)[number];
    switch (defect % 9) {
      case 0:
        column = "Name";
        row.Name = "";
        break;
      case 1:
      case 2:
      case 3:
        column = "Selling Price";
        row[column] = ["abc", "0", "12.34567"][(defect % 9) - 1];
        break;
      case 4:
        column = "SKU";
        row.SKU = copy[0].SKU;
        break;
      case 5:
        column = "Barcodes";
        row.Barcodes = String(copy[0].Barcodes).split(";")[0];
        break;
      case 6: {
        column = "Barcodes";
        const barcode = String(row.Barcodes).split(";")[0];
        row.Barcodes = `${barcode.slice(0, 12)}${(Number(barcode[12]) + 1) % 10}`;
        break;
      }
      case 7:
        column = "Tax Class";
        row[column] = "luxury";
        break;
      default:
        column = "Unit";
        row.Unit = "crate";
    }
    bad.push({ row: index + 2, column });
  }
  return { rows: copy, bad };
}

export function toSpreadsheet(rows: SheetRow[], format: "csv" | "xlsx"): Uint8Array {
  const sheet = XLSX.utils.aoa_to_sheet([
    [...catalogueHeaders],
    ...rows.map((row) => catalogueHeaders.map((header) => row[header])),
  ]);
  for (const [index, row] of rows.entries()) {
    for (const column of [0, 2, 3, 10]) {
      const cell = sheet[XLSX.utils.encode_cell({ r: index + 1, c: column })];
      const value = String(row[catalogueHeaders[column]]);
      const numericPrice = column === 10 && /^\d+(?:\.\d{1,2})?$/.test(value);
      cell.t = numericPrice ? "n" : "s";
      cell.v = numericPrice ? Number(value) : value;
      if (numericPrice) cell.z = "0.00";
    }
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Catalogue");
  return new Uint8Array(XLSX.write(workbook, { type: "array", bookType: format }));
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function ean13(body: string): string {
  const sum = body
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
  return `${body}${(10 - (sum % 10)) % 10}`;
}

const suppliers = [
  "Nestlé Ghana",
  "Unilever Ghana",
  "GBfoods Ghana",
  "Wilmar Africa",
  "Olam Ghana",
  "Voltic Ghana",
  "Twellium Industrial",
  "Guinness Ghana",
  "Accra Brewery",
  "Fan Milk Ghana",
  "Promasidor Ghana",
  "PZ Cussons Ghana",
  "Melcom Wholesale",
  "Makola Traders",
  "Agbogbloshie Produce",
];

const products = [
  ["Milo", "400g|800g|1kg", "Beverages", "Malt & Cocoa", "Standard"],
  ["Peak Milk", "170g|400g|900g", "Dairy", "Milk", "Standard"],
  ["Gino Tomato Paste", "70g|210g|400g", "Groceries", "Canned Food", "Standard"],
  ["Frytol Oil", "500ml|1L|5L", "Groceries", "Cooking Oils", "Standard"],
  ["Royal Aroma Rice", "1kg|5kg|25kg", "Groceries", "Rice & Grains", "Zero-rated"],
  ["Voltic Water", "500ml|1.5L|5L", "Beverages", "Water", "Standard"],
  ["Kalyppo", "250ml|330ml", "Beverages", "Soft drinks", "Standard"],
  ["Ideal Milk", "170g|400g", "Dairy", "Milk", "Standard"],
  ["Titus Sardines", "125g|155g", "Groceries", "Canned Food", "Standard"],
  ["Nido", "400g|900g|1.8kg", "Dairy", "Milk", "Standard"],
  ["Golden Penny Spaghetti", "250g|500g|1kg", "Groceries", "Pasta", "Standard"],
  ["Sunlight Soap", "125g|500g|1kg", "Household", "Detergents", "Standard"],
  ["Key Soap", "125g|250g|500g", "Household", "Detergents", "Standard"],
  ["Malta Guinness", "330ml|500ml", "Beverages", "Soft drinks", "Standard"],
  ["Club Beer", "330ml|625ml", "Beverages", "Beer", "Standard"],
  ["Fan Ice", "150ml|250ml|500ml", "Dairy", "Ice Cream", "Standard"],
  ["Cowbell", "200g|400g|900g", "Dairy", "Milk", "Standard"],
  ["Indomie Chicken", "70g|120g", "Groceries", "Noodles", "Standard"],
  ["Sasso Rice", "1kg|5kg|25kg", "Groceries", "Rice & Grains", "Zero-rated"],
  ["Makola Dried Beans", "500g|1kg|5kg", "Groceries", "Rice & Grains", "Zero-rated"],
  ["Always Sanitary Pads", "8 pieces|16 pieces", "Personal Care", "Sanitary Care", "Exempt"],
] as const;

const produce = [
  ["Fresh Tomatoes", "Loose", "Fresh", "Produce", "Zero-rated"],
  ["Garden Eggs", "Loose", "Fresh", "Produce", "Zero-rated"],
  ["Plantain", "Loose", "Fresh", "Produce", "Zero-rated"],
  ["Yam", "Loose", "Fresh", "Produce", "Zero-rated"],
  ["Red Onions", "Loose", "Fresh", "Produce", "Zero-rated"],
] as const;
