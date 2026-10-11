import { expect, test } from "vite-plus/test";
import {
  postOk,
  allAuditRows,
  auditRowsFor,
  barcode,
  call,
  createProduct,
  expectChainValid,
  unique,
} from "./support";

type Page = { items: { id: string; sku: string; name: string }[]; nextCursor: string | null };
const search = async (query: string) => (await (await call(`/products?${query}`)).json()) as Page;

test("a product keeps several barcodes and each finds it", async () => {
  const [first, second, third] = [barcode(), barcode(), barcode()];
  const product = await createProduct({ name: "Gino Tomato Paste", barcodes: [{ code: first }] });
  for (const code of [second, third])
    expect((await call(`/products/${product.id}/barcodes`, "POST", { code })).status).toBe(201);

  const detail = await (await call(`/products/${product.id}`)).json();
  expect(detail.barcodes.map((b: { code: string }) => b.code).sort()).toEqual(
    [first, second, third].sort(),
  );
  for (const code of [first, second, third]) {
    const found = await call(`/barcodes/${code}`);
    expect(found.status).toBe(200);
    expect(await found.json()).toMatchObject({
      product: {
        id: product.id,
        sku: product.sku,
        name: "Gino Tomato Paste",
        baseUnit: "each",
        taxClass: "standard",
      },
      quantityThousandths: 1000,
      price: null,
    });
  }

  expect((await call(`/products/${product.id}/barcodes/${second}`, "DELETE")).status).toBe(204);
  expect((await call(`/barcodes/${second}`)).status).toBe(404);
  expect((await call(`/barcodes/${first}`)).status).toBe(200);
});

test("a case barcode returns the pack quantity in thousandths", async () => {
  const unit = barcode();
  const pack = barcode();
  const product = await createProduct({
    name: "Voltic Water 500ml",
    barcodes: [{ code: unit }, { code: pack, quantityThousandths: 24000 }],
  });
  expect(await (await call(`/barcodes/${unit}`)).json()).toMatchObject({
    product: { id: product.id },
    quantityThousandths: 1000,
  });
  expect(await (await call(`/barcodes/${pack}`)).json()).toMatchObject({
    product: { id: product.id },
    quantityThousandths: 24000,
  });
  const added = barcode();
  const response = await call(`/products/${product.id}/barcodes`, "POST", {
    code: added,
    quantityThousandths: 6000,
  });
  expect(response.status).toBe(201);
  expect(await (await call(`/barcodes/${added}`)).json()).toMatchObject({
    quantityThousandths: 6000,
  });
  expect((await call("/barcodes/0000000000000")).status).toBe(404);
});

test("a barcode already on another product is rejected with 409", async () => {
  const shared = barcode();
  await createProduct({ barcodes: [{ code: shared }] });
  const other = await createProduct();
  const before = (await allAuditRows()).length;

  const add = await call(`/products/${other.id}/barcodes`, "POST", { code: shared });
  expect(add.status).toBe(409);
  const create = await call("/products", "POST", {
    sku: unique("DUP"),
    name: "Dup",
    baseUnit: "each",
    taxClass: "standard",
    barcodes: [{ code: shared }],
  });
  expect(create.status).toBe(409);

  expect((await allAuditRows()).length).toBe(before);
  expect((await (await call(`/products/${other.id}`)).json()).barcodes).toEqual([]);
  expect(await auditRowsFor(other.id)).toHaveLength(1);
  expect((await search(`q=DUP`)).items.filter((p) => p.name === "Dup")).toHaveLength(0);
});

test("adding and removing a barcode each leave one audit row", async () => {
  const product = await createProduct();
  const code = barcode();
  const before = (await allAuditRows()).length;
  await call(`/products/${product.id}/barcodes`, "POST", { code, quantityThousandths: 12000 });
  const added = (await allAuditRows()).slice(before);
  expect(added).toHaveLength(1);
  expect(added[0]!.entityId).toBeTruthy();
  expect(JSON.stringify(added[0]!.after)).toContain(code);

  await call(`/products/${product.id}/barcodes/${code}`, "DELETE");
  const removed = (await allAuditRows()).slice(before + 1);
  expect(removed).toHaveLength(1);
  expect(JSON.stringify(removed[0]!.before)).toContain(code);
  await expectChainValid();
});

test("search finds by name fragment, sku and barcode, and pages with a cursor", async () => {
  const token = unique("Zorbax").replace(/-/g, "");
  const code = barcode();
  const products = [];
  for (let i = 0; i < 5; i++)
    products.push(
      await createProduct({
        name: `${token} Rice ${i}`,
        ...(i === 0 ? { barcodes: [{ code }] } : {}),
      }),
    );
  const ids = products.map((p) => p.id).sort();

  const insensitive = await search(`q=${token.toUpperCase().slice(0, 4)}${token.slice(4)}`);
  expect(insensitive.items.map((p) => p.id).sort()).toEqual(ids);
  expect((await search(`q=${products[3]!.sku}`)).items.map((p) => p.id)).toEqual([products[3]!.id]);
  expect((await search(`q=${code}`)).items.map((p) => p.id)).toEqual([products[0]!.id]);
  expect((await search(`q=${token}-nothing`)).items).toEqual([]);

  const seen: string[] = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    const page: Page = await search(
      `q=${token}&limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    expect(page.items.length).toBeLessThanOrEqual(2);
    seen.push(...page.items.map((p) => p.id));
    cursor = page.nextCursor;
    pages++;
  } while (cursor && pages < 10);
  expect(pages).toBe(3);
  expect(new Set(seen).size).toBe(5);
  expect([...seen].sort()).toEqual(ids);
});

test("search filters by category", async () => {
  const category = await postOk("/categories", { name: unique("Filter category") });
  const inside = await createProduct({ categoryId: category.id });
  await createProduct();
  const result = await search(`categoryId=${category.id}`);
  expect(result.items.map((p) => p.id)).toEqual([inside.id]);
  expect(result.nextCursor).toBeNull();
});
