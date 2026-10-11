import { expect, test } from "vite-plus/test";
import { generateCatalogue, toSpreadsheet } from "../../../tooling/lib/catalogue-fixture";
import { call } from "./support";
import { upload, type ImportResult } from "./import-support";

test("20,000 SKUs import in one go within the time budget", { timeout: 120_000 }, async () => {
  const rows = generateCatalogue(20_000, 11);
  const file = toSpreadsheet(rows, "xlsx");

  const started = Date.now();
  const response = await upload(file, "catalogue-20k.xlsx");
  const elapsed = Date.now() - started;

  expect(response.status).toBe(201);
  const result = (await response.json()) as ImportResult;
  expect(result).toMatchObject({
    rowsTotal: 20_000,
    rowsOk: 20_000,
    rowsFailed: 0,
    created: 20_000,
    updated: 0,
    unchanged: 0,
    errors: [],
  });
  expect(result.pricesAdded).toBe(20_000);
  expect(elapsed).toBeLessThan(60_000);

  const pack = rows.find((row) => row["Pack Barcode"] !== "")!;
  const found = await call(`/barcodes/${pack["Pack Barcode"]}`);
  expect(found.status).toBe(200);
  const [whole, cents] = String(pack["Selling Price"]).split(".");
  expect(await found.json()).toMatchObject({
    product: { sku: pack.SKU, name: pack.Name },
    quantityThousandths: Number(pack["Pack Qty"]) * 1000,
    price: { amount: Number(whole) * 10_000 + Number(cents) * 100 },
  });
  const single = await call(`/barcodes/${String(rows[19_999]!.Barcodes).split(";")[0]}`);
  expect((await single.json()).quantityThousandths).toBe(1000);
});
