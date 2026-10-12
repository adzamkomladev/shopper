import { expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { context, db, unique } from "../support";
import { csv, detail, ean13, importOk, upload, type ImportResult } from "./support";

const head = ["SKU", "Name", "Selling Price"];

test("prices accept thousands commas only; decimal commas and cents are row errors", async () => {
  const tag = unique("PRC");
  const prices = ["1,250.50", "GHS 3,000", "1,50", "50¢", "1,2345", "12,34,567"];
  const result = await importOk(
    csv(
      [...head, "Tax Class"],
      prices.map((p, i) => [`${tag}-${i}`, "Item", p, "Standard"]),
    ),
  );
  expect(result).toMatchObject({ rowsOk: 2, rowsFailed: 4 });
  expect(result.errors.map((e) => [e.row, e.column, e.value])).toEqual([
    [4, "Selling Price", "1,50"],
    [5, "Selling Price", "50¢"],
    [6, "Selling Price", "1,2345"],
    [7, "Selling Price", "12,34,567"],
  ]);
  expect((await detail(`${tag}-0`))!.prices[0]!.amount).toBe(12505000);
  expect((await detail(`${tag}-1`))!.prices[0]!.amount).toBe(30000000);
});

test("a missing tax class is a row error on the tax column; dry run and apply agree", async () => {
  await db
    .delete(schema.taxClass)
    .where(and(eq(schema.taxClass.orgId, context.orgId), eq(schema.taxClass.code, "exempt")));
  const tag = unique("TAX");
  const file = csv(
    [...head, "Tax Class"],
    [
      [`${tag}-1`, "Bread", "2", "Exempt"],
      [`${tag}-2`, "Milk", "3", "Standard"],
    ],
  );
  const dry = (await (await upload(file, "c.csv", { dryRun: true })).json()) as ImportResult;
  const result = await importOk(file);
  for (const r of [dry, result]) {
    expect(r).toMatchObject({ rowsOk: 1, rowsFailed: 1, created: 1 });
    expect(r.errors).toMatchObject([{ row: 2, column: "Tax Class", value: "exempt" }]);
  }
  expect(await detail(`${tag}-2`)).toBeDefined();
});

test("a multipart upload without a file field says so; an unreadable body says that instead", async () => {
  const form = new FormData();
  form.set("other", "x");
  const { api, cookies } = await import("../support");
  const missing = await api.request("/catalogue/imports", {
    method: "POST",
    headers: { cookie: cookies.get("superadmin")! },
    body: form,
  });
  expect(missing.status).toBe(400);
  expect(await missing.json()).toEqual({ error: "Send the spreadsheet as a file field" });
  const broken = await api.request("/catalogue/imports", {
    method: "POST",
    headers: { cookie: cookies.get("superadmin")!, "content-type": "multipart/form-data" },
    body: "not multipart",
  });
  expect(broken.status).toBe(400);
  expect((await broken.json()).error).toMatch(/^Could not read the upload/);
});

test("empty sheets, non-UTF-8 CSVs and ambiguous headers get their own 400s", async () => {
  const message = async (bytes: Uint8Array | string) => {
    const response = await upload(bytes);
    expect(response.status).toBe(400);
    return ((await response.json()) as { error: string }).error;
  };
  expect(await message("\n\n")).toBe("The first sheet is empty");
  expect(await message(new Uint8Array([0x53, 0x4b, 0x55, 0x2c, 0xe9, 0x0a]))).toBe(
    "Save the CSV as UTF-8 and upload it again",
  );
  expect(await message(csv(["Code", "SKU", "Name", "Selling Price"], [["a", "b", "c", "1"]]))).toBe(
    'Columns "Code" and "SKU" both mean sku',
  );
  const codes = ["Barcode", "Barcodes", ...head];
  expect(await message(csv(codes, [[ean13(), ean13(), "a", "b", "1"]]))).toBe(
    'Columns "Barcode" and "Barcodes" both mean barcodes',
  );
});

test("a blank tax class is a row error, and new products need the Tax Class column", async () => {
  const tag = unique("TAX");
  const blank = await importOk(
    csv(
      [...head, "Tax Class"],
      [
        [`${tag}-1`, "Gari 1kg", "18.00", ""],
        [`${tag}-2`, "Sugar 1kg", "21.00", "Standard"],
      ],
    ),
  );
  expect(blank).toMatchObject({ rowsOk: 1, rowsFailed: 1 });
  expect(blank.errors).toMatchObject([{ row: 2, column: "Tax Class", value: "" }]);
  const missing = await importOk(csv(head, [[`${tag}-3`, "Rice 5kg", "120.00"]]));
  expect(missing).toMatchObject({ rowsOk: 0, rowsFailed: 1 });
  expect(missing.errors).toMatchObject([{ row: 2, column: "Tax Class" }]);
  const existing = await importOk(csv(head, [[`${tag}-2`, "Sugar 1kg bag", "21.00"]]));
  expect(existing).toMatchObject({ rowsOk: 1, updated: 1 });
  expect((await detail(`${tag}-2`))!.taxClass).toBe("standard");
});
