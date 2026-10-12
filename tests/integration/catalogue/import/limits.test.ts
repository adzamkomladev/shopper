import { expect, test } from "vite-plus/test";
import * as XLSX from "xlsx";
import { api, cookies, unique } from "../support";
import { csv, importOk, productRow, sheetRows, upload, type ImportResult } from "./support";

const head = ["SKU", "Name", "Selling Price"];
const message = async (response: Response) => ((await response.json()) as { error: string }).error;

test("a tiny XLSX that declares a million rows is rejected before it is expanded", async () => {
  const sheet = XLSX.utils.aoa_to_sheet([head, ["a", "b", 1]]);
  sheet["!ref"] = "A1:C1048576";
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Catalogue");
  const response = await upload(XLSX.write(book, { type: "array", bookType: "xlsx" }), "big.xlsx");
  expect(response.status).toBe(400);
  expect(await message(response)).toBe(
    "The sheet is too large: at most 50,000 rows and 50 columns",
  );
});

test("a declared Content-Length over the limit is refused before the body is read", async () => {
  const response = await api.request("/catalogue/imports", {
    method: "POST",
    headers: { cookie: cookies.get("superadmin")!, "content-length": String(11 * 1024 * 1024) },
    body: new FormData(),
  });
  expect(response.status).toBe(413);
});

test("a chunked upload with no Content-Length still stops at 10 MB", async () => {
  const chunk = new Uint8Array(1024 * 1024);
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent++ < 12) controller.enqueue(chunk);
      else controller.close();
    },
  });
  const response = await api.request("/catalogue/imports", {
    method: "POST",
    headers: {
      cookie: cookies.get("superadmin")!,
      "content-type": "multipart/form-data; boundary=x",
    },
    body,
    duplex: "half",
  } as RequestInit);
  expect(response.status).toBe(413);
  expect(sent).toBeLessThan(13);
});

test(
  "22,000 new categories and suppliers import without exceeding bind parameters",
  {
    timeout: 120_000,
  },
  async () => {
    const tag = unique("BIG");
    const rows = Array.from({ length: 22_000 }, (_, i) => [
      `${tag}-${i}`,
      "Item",
      "1.00",
      `${tag} cat ${i}`,
      `${tag} sup ${i}`,
      "Standard",
    ]);
    const result = await importOk(csv([...head, "Category", "Supplier", "Tax Class"], rows));
    expect(result).toMatchObject({ rowsOk: 22_000, created: 22_000 });
  },
);

test("inherited object keys are not flags, tax classes or headers", async () => {
  const tag = unique("PRO");
  const result = await importOk(
    csv(
      [...head, "Online", "Tax Class", "toString"],
      [
        [`${tag}-1`, "A", "1", "constructor", "Standard", "x"],
        [`${tag}-2`, "B", "1", "No", "constructor", "x"],
        [`${tag}-3`, "C", "1", "No", "Standard", "x"],
      ],
    ),
  );
  expect(result).toMatchObject({ rowsOk: 1, rowsFailed: 2 });
  expect(result.errors.map((e) => [e.row, e.column])).toEqual([
    [2, "Online"],
    [3, "Tax Class"],
  ]);
});

test("a re-import without optional columns leaves those fields as they were", async () => {
  const tag = unique("KEEP");
  const [full] = sheetRows(2, tag);
  const columns = Object.keys(full!);
  const rows = sheetRows(2, tag);
  await importOk(
    csv(
      columns,
      rows.map((r) => columns.map((c) => r[c as keyof typeof r] ?? "")),
    ),
  );
  const before = await productRow(`${tag}-1`);
  const same = await productRow(`${tag}-2`);

  const small = [
    [`${tag}-1`, "Renamed", rows[0]!["Selling Price"]],
    [`${tag}-2`, same!.name, rows[1]!["Selling Price"]],
  ];
  const result = (await (await upload(csv(head, small))).json()) as ImportResult;
  expect(result).toMatchObject({ updated: 1, unchanged: 1, created: 0, pricesAdded: 0 });
  const after = await productRow(`${tag}-1`);
  expect(after).toMatchObject({
    name: "Renamed",
    categoryId: before!.categoryId,
    supplierId: before!.supplierId,
    baseUnit: before!.baseUnit,
    taxClassId: before!.taxClassId,
    onlineVisible: before!.onlineVisible,
  });
  expect(before!.categoryId).not.toBeNull();
});
