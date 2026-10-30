import { expect, test } from "vite-plus/test";
import * as v from "valibot";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { boxCache, boxRateLimiter } from "@shopper/adapters-box";
import { serveRuntime } from "@shopper/api/runtime";
import {
  branchView,
  categoryView,
  importPreview,
  importResult,
  importRecord,
  orgSummary,
  priceView,
  productDetail,
  productPage,
  productSummary,
  supplierView,
} from "@shopper/core/schemas";
import { toSpreadsheet } from "../../../tooling/lib/catalogue/fixture";
import { baseURL, secret } from "../auth/setup";
import { barcode, call, context, createProduct, db, postOk, unique } from "./support";
import { importOk, sheetRows, upload } from "./import/support";

const rateLimiter = boxRateLimiter();

type Page = { items: { id: string; price: number | null }[]; nextCursor: string | null };
const json = async (response: Response, status = 200) => {
  expect(response.status).toBe(status);
  return response.json();
};
const listed = async (query: string) => (await json(await call(`/products?${query}`))) as Page;
const setPrice = (productId: string, body: Record<string, unknown>) =>
  call(`/products/${productId}/prices`, "POST", { reason: "View test", ...body });

test("product list, detail and create responses parse with the view schemas", async () => {
  const created = await createProduct({
    barcodes: [{ code: barcode(), quantityThousandths: 12000 }],
  });
  expect(v.parse(productDetail, created).barcodes).toHaveLength(1);
  await setPrice(created.id, { amount: 12500 });
  v.parse(productDetail, await json(await call(`/products/${created.id}`)));
  const page = v.parse(productPage, await listed(`q=${created.sku}`));
  expect(page.items.map((item) => v.parse(productSummary, item).id)).toEqual([created.id]);
});

test("price, category and supplier responses parse with the view schemas", async () => {
  const product = await createProduct();
  v.parse(priceView, await json(await setPrice(product.id, { amount: 9000 }), 201));
  const now = encodeURIComponent(new Date().toISOString());
  v.parse(priceView, await json(await call(`/prices/at?productId=${product.id}&at=${now}`)));
  const store = await postOk("/stores", { name: unique("Views store") });
  const branch = await postOk("/branches", { name: unique("Views branch"), storeId: store.id });
  expect(v.parse(v.array(branchView), await json(await call("/branches")))).toContainEqual({
    id: branch.id,
    name: branch.name,
    storeId: store.id,
  });
  v.parse(categoryView, await postOk("/categories", { name: unique("Views cat") }));
  v.parse(
    supplierView,
    await postOk("/suppliers", { name: unique("Views sup"), phone: "0244000000" }),
  );
  expect(v.parse(v.array(categoryView), await json(await call("/categories")))).not.toHaveLength(0);
  expect(v.parse(v.array(supplierView), await json(await call("/suppliers")))).not.toHaveLength(0);
});

test("a price carries its reason in the set response, the product detail and the price lookup", async () => {
  const product = await createProduct();
  const reason = unique("Supplier raised cost");
  const set = v.parse(
    priceView,
    await json(await setPrice(product.id, { amount: 12500, reason }), 201),
  );
  expect(set.reason).toBe(reason);
  const detail = v.parse(productDetail, await json(await call(`/products/${product.id}`)));
  expect(detail.prices.map((price) => price.reason)).toEqual([reason]);
  const now = encodeURIComponent(new Date().toISOString());
  const at = await json(await call(`/prices/at?productId=${product.id}&at=${now}`));
  expect(v.parse(priceView, at).reason).toBe(reason);
});

test("import preview and import record responses parse with the view schemas", async () => {
  const sheet = toSpreadsheet(sheetRows(3), "csv");
  v.parse(importPreview, await json(await upload(sheet, "preview.csv", { dryRun: true })));
  const run = await importOk(sheet, "views.csv");
  expect(v.parse(importResult, run).id).toBe(run.id);
  v.parse(importRecord, await json(await call(`/catalogue/imports/${run.id}`)));
});

test("the shop code lookup parses with the orgSummary view schema", async () => {
  const [row] = await db.select().from(schema.org).where(eq(schema.org.id, context.orgId));
  const cache = boxCache(":memory:");
  const response = await serveRuntime(new Request(`http://localhost/orgs/${row!.slug}`), {
    database: db,
    cache: cache.cache,
    rateLimiter,
    secret,
    baseURL,
  });
  cache.close();
  expect(v.parse(orgSummary, await json(response))).toEqual({
    id: context.orgId,
    name: "Auth tenant",
  });
});

test("the list shows each product's current org-wide price, or null", async () => {
  const tag = unique("PRICED");
  const made = [];
  for (const n of [1, 2, 3, 4]) made.push(await createProduct({ name: `${tag} ${n}` }));
  const [past, branchOnly, scheduled, none] = made;
  await setPrice(past!.id, { amount: 10000, validFrom: "2026-01-01T00:00:00Z" });
  await setPrice(past!.id, { amount: 15000, validFrom: "2026-02-01T00:00:00Z" });
  const store = await postOk("/stores", { name: unique("View store") });
  const branch = await postOk("/branches", { name: unique("View branch"), storeId: store.id });
  await setPrice(branchOnly!.id, { amount: 8000, branchId: branch.id });
  await setPrice(scheduled!.id, { amount: 20000, validFrom: "2099-01-01T00:00:00Z" });

  const items = new Map((await listed(`q=${tag}`)).items.map((item) => [item.id, item.price]));
  expect(items.get(past!.id)).toBe(15000);
  expect(items.get(branchOnly!.id)).toBeNull();
  expect(items.get(scheduled!.id)).toBeNull();
  expect(items.get(none!.id)).toBeNull();
});

test("the list is newest first, across pages", async () => {
  const tag = unique("ORDER");
  const ids: string[] = [];
  for (const n of [1, 2, 3]) ids.unshift((await createProduct({ name: `${tag} ${n}` })).id);
  const first = await listed(`q=${tag}&limit=2`);
  expect(first.items.map((item) => item.id)).toEqual(ids.slice(0, 2));
  expect(first.nextCursor).not.toBeNull();
  const second = await listed(`q=${tag}&limit=2&cursor=${first.nextCursor}`);
  expect(second.items.map((item) => item.id)).toEqual(ids.slice(2));
  expect(second.nextCursor).toBeNull();
});
