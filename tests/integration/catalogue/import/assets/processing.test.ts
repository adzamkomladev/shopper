import * as XLSX from "xlsx";
import { expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { asset, productImport } from "@shopper/db-pg";
import { readImportAsset } from "@shopper/assets";
import { sha256 } from "@shopper/utils";
import { importApi, importStorage } from "../../../../support/assets/storage";
import { allAuditRows, context, cookies, db, unique } from "../../support";

const bytes = () =>
  new TextEncoder().encode(`SKU,Name,Selling Price,Tax Class\n${unique("ASSET")},Item,2,Standard`);
async function grant(sheet: Uint8Array, extra: Record<string, unknown> = {}) {
  const api = await importApi();
  const response = await api.request("/catalogue/imports/uploads", {
    method: "POST",
    headers: { cookie: cookies.get("superadmin")!, "content-type": "application/json" },
    body: JSON.stringify({
      fileName: "catalogue.csv",
      contentType: "text/csv",
      sizeBytes: sheet.length,
      sha256: await sha256(sheet),
      ...extra,
    }),
  });
  expect(response.status).toBe(201);
  return (await response.json()) as {
    assetId: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    expiresAt: number;
  };
}
async function process(id: string, dryRun = false, other = false) {
  return (await importApi(other)).request(`/catalogue/imports${dryRun ? "?dryRun=1" : ""}`, {
    method: "POST",
    headers: {
      cookie: cookies.get(other ? "other" : "superadmin")!,
      "content-type": "application/json",
    },
    body: JSON.stringify({ assetId: id }),
  });
}

test("a direct upload is private, tracked and audited without recording its bearer grant", async () => {
  const issued = await grant(bytes());
  const [record] = await db.select().from(asset).where(eq(asset.id, issued.assetId));
  expect(record).toMatchObject({
    orgId: context.orgId,
    purpose: "catalogue_import",
    bucket: "imports",
    visibility: "private",
    key: `imports/${issued.assetId}`,
  });
  const entries = (await allAuditRows()).filter((row) => row.entityId === issued.assetId);
  expect(entries).toHaveLength(1);
  expect(entries[0]!.command).toBe("asset.upload.issue");
  expect(JSON.stringify(entries)).not.toContain("X-Amz-Signature");
});

test("missing and foreign import assets cannot be processed", async () => {
  const issued = await grant(bytes());
  expect((await process(issued.assetId)).status).toBe(409);
  expect((await process(issued.assetId, true, true)).status).toBe(404);
});

test("replaced bytes are rejected before preview and before final import", async () => {
  const sheet = bytes();
  const issued = await grant(sheet);
  expect(
    (await fetch(issued.url, { method: issued.method, headers: issued.headers, body: sheet })).ok,
  ).toBe(true);
  expect((await process(issued.assetId, true)).status).toBe(200);
  const changed = new Uint8Array(sheet);
  changed[0] = 0;
  expect(
    (await fetch(issued.url, { method: issued.method, headers: issued.headers, body: changed })).ok,
  ).toBe(true);
  expect((await process(issued.assetId, true)).status).toBe(409);
  expect((await process(issued.assetId)).status).toBe(409);
  expect(
    await db.select().from(productImport).where(eq(productImport.assetId, issued.assetId)),
  ).toHaveLength(0);
});

test("actual oversized objects and expired uploads cannot be processed", async () => {
  const issued = await grant(bytes());
  const oversized = new Uint8Array(10 * 1024 * 1024 + 1);
  expect(
    (await fetch(issued.url, { method: issued.method, headers: issued.headers, body: oversized }))
      .ok,
  ).toBe(true);
  expect((await process(issued.assetId)).status).toBe(413);
  await expect(
    readImportAsset(
      db,
      await importStorage(),
      context.orgId,
      issued.assetId,
      () => issued.expiresAt,
    ),
  ).rejects.toThrow("expired");
});

test("the same asset commits once and retries return its persisted result without another audit", async () => {
  const sheet = bytes();
  const issued = await grant(sheet);
  await fetch(issued.url, { method: issued.method, headers: issued.headers, body: sheet });
  expect((await process(issued.assetId, true)).status).toBe(200);
  const first = await process(issued.assetId);
  expect(first.status).toBe(201);
  const result = await first.json();
  const auditCount = (await allAuditRows()).length;
  const again = await process(issued.assetId);
  expect(again.status).toBe(201);
  expect(await again.json()).toEqual(result);
  expect((await allAuditRows()).length).toBe(auditCount);
  expect(
    await db
      .select()
      .from(productImport)
      .where(
        and(eq(productImport.orgId, context.orgId), eq(productImport.assetId, issued.assetId)),
      ),
  ).toHaveLength(1);
});

test("a completed import remains replayable after the original uploaded bytes are removed", async () => {
  const sheet = bytes();
  const issued = await grant(sheet);
  await fetch(issued.url, { method: issued.method, headers: issued.headers, body: sheet });
  const first = await process(issued.assetId);
  expect(first.status).toBe(201);
  const result = await first.json();
  await (await importStorage()).delete(context.orgId, `imports/${issued.assetId}`);
  const again = await process(issued.assetId);
  expect(again.status).toBe(201);
  expect(await again.json()).toEqual(result);
});

test("a genuine legacy XLS workbook uploads directly and can be previewed and imported", async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["SKU", "Name", "Selling Price", "Tax Class"],
      [unique("XLS"), "Legacy workbook product", "2.50", "Standard"],
    ]),
    "Catalogue",
  );
  const sheet = new Uint8Array(XLSX.write(workbook, { bookType: "biff8", type: "array" }));
  expect(Array.from(sheet.slice(0, 8))).toEqual([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const issued = await grant(sheet, {
    fileName: "catalogue.xls",
    contentType: "application/vnd.ms-excel",
  });
  expect(
    (await fetch(issued.url, { method: issued.method, headers: issued.headers, body: sheet })).ok,
  ).toBe(true);
  const preview = await process(issued.assetId, true);
  expect(preview.status).toBe(200);
  expect(await preview.json()).toMatchObject({ dryRun: true, rowsOk: 1, rowsFailed: 0 });
  const imported = await process(issued.assetId);
  expect(imported.status).toBe(201);
  expect(await imported.json()).toMatchObject({
    dryRun: false,
    rowsOk: 1,
    created: 1,
    rowsFailed: 0,
  });
});
