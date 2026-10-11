import { expect, test } from "vite-plus/test";
import {
  postOk,
  allAuditRows,
  auditRowsFor,
  barcode,
  call,
  createProduct,
  expectChainValid,
  otherApi,
  cookies,
  request,
  unique,
} from "./support";

test("online_visible defaults to off", async () => {
  const hidden = await createProduct();
  expect(hidden.onlineVisible).toBe(false);
  const shown = await createProduct({ onlineVisible: true });
  expect(shown.onlineVisible).toBe(true);
  expect(
    ((await (await call(`/products/${hidden.id}`)).json()) as typeof hidden).onlineVisible,
  ).toBe(false);
});

test("a product is created, read back and updated through the API", async () => {
  const created = await createProduct({
    name: "Fresh Tomatoes",
    baseUnit: "kg",
    taxClass: "zero-rated",
  });
  expect(created).toMatchObject({
    name: "Fresh Tomatoes",
    baseUnit: "kg",
    taxClass: "zero-rated",
    archivedAt: null,
    barcodes: [],
    prices: [],
  });
  const patched = await call(`/products/${created.id}`, "PATCH", {
    name: "Fresh Roma Tomatoes",
    taxClass: "exempt",
    onlineVisible: true,
  });
  expect(patched.status).toBe(200);
  expect(await patched.json()).toMatchObject({
    id: created.id,
    name: "Fresh Roma Tomatoes",
    taxClass: "exempt",
    onlineVisible: true,
    baseUnit: "kg",
  });
  expect((await call(`/products/${created.id}`, "PATCH", {})).status).toBe(400);
});

test("invalid product bodies are rejected with 400 and create nothing", async () => {
  const before = (await allAuditRows()).length;
  const valid = { sku: unique("BAD"), name: "Bad", baseUnit: "each", taxClass: "standard" };
  for (const bad of [
    { ...valid, baseUnit: "lbs" },
    { ...valid, taxClass: "reduced" },
    { ...valid, name: "" },
    { ...valid, unexpected: true },
    { ...valid, barcodes: [{ code: barcode(), quantityThousandths: 0 }] },
    { ...valid, barcodes: [{ code: barcode(), quantityThousandths: 1.5 }] },
    { sku: valid.sku, baseUnit: "each", taxClass: "standard" },
  ])
    expect((await call("/products", "POST", bad)).status, JSON.stringify(bad)).toBe(400);
  expect((await call("/products/not-a-uuid")).status).toBe(404);
  expect((await allAuditRows()).length).toBe(before);
  expect(
    ((await (await call(`/products?q=${valid.sku}`)).json()) as { items: unknown[] }).items,
  ).toHaveLength(0);
});

test("a duplicate sku is rejected with 409 and leaves no audit row", async () => {
  const first = await createProduct();
  const before = (await allAuditRows()).length;
  const again = await call("/products", "POST", {
    sku: first.sku,
    name: "Clone",
    baseUnit: "each",
    taxClass: "standard",
  });
  expect(again.status).toBe(409);
  expect((await allAuditRows()).length).toBe(before);
});

test("every product write leaves one audit row with before and after", async () => {
  const created = await createProduct({ name: "Audited Rice" });
  const afterCreate = await auditRowsFor(created.id);
  expect(afterCreate).toHaveLength(1);
  expect(afterCreate[0]).toMatchObject({
    entity: expect.any(String),
    entityId: created.id,
    before: null,
  });
  expect(afterCreate[0]!.after).toMatchObject({ sku: created.sku, name: "Audited Rice" });

  await call(`/products/${created.id}`, "PATCH", { name: "Audited Jasmine Rice" });
  const afterPatch = await auditRowsFor(created.id);
  expect(afterPatch).toHaveLength(2);
  expect(afterPatch[1]!.before).toMatchObject({ name: "Audited Rice" });
  expect(afterPatch[1]!.after).toMatchObject({ name: "Audited Jasmine Rice" });

  expect((await call(`/products/${created.id}`, "DELETE")).status).toBe(204);
  const afterArchive = await auditRowsFor(created.id);
  expect(afterArchive).toHaveLength(3);
  expect(afterArchive[2]!.before).toMatchObject({ archivedAt: null });
  expect(afterArchive[2]!.after).toMatchObject({ archivedAt: expect.any(String) });
  await expectChainValid();
});

test("archived products drop out of search and barcode lookup but stay readable by id", async () => {
  const code = barcode();
  const product = await createProduct({ name: "Retired Biscuits", barcodes: [{ code }] });
  const search = async (q: string) =>
    ((await (await call(`/products?q=${q}`)).json()) as { items: { id: string }[] }).items;
  expect((await search("Retired Biscuits")).map((p) => p.id)).toEqual([product.id]);
  expect((await call(`/barcodes/${code}`)).status).toBe(200);

  expect((await call(`/products/${product.id}`, "DELETE")).status).toBe(204);
  expect(await search("Retired Biscuits")).toHaveLength(0);
  expect(await search(product.sku)).toHaveLength(0);
  expect(await search(code)).toHaveLength(0);
  expect((await call(`/barcodes/${code}`)).status).toBe(404);
  const detail = await (await call(`/products/${product.id}`)).json();
  expect(detail).toMatchObject({ id: product.id, archivedAt: expect.any(String) });
});

test("org B cannot read or change org A's products", async () => {
  const code = barcode();
  const product = await createProduct({ barcodes: [{ code }] });
  const asB = (path: string, method = "GET", body?: unknown) =>
    request(otherApi, cookies.get("other")!, path, method, body);
  expect((await asB(`/products/${product.id}`)).status).toBe(404);
  expect((await asB(`/products/${product.id}`, "PATCH", { name: "Hijacked" })).status).toBe(404);
  expect((await asB(`/products/${product.id}`, "DELETE")).status).toBe(404);
  expect((await asB(`/products/${product.id}/barcodes`, "POST", { code: barcode() })).status).toBe(
    404,
  );
  expect((await asB(`/products/${product.id}/barcodes/${code}`, "DELETE")).status).toBe(404);
  expect((await asB(`/barcodes/${code}`)).status).toBe(404);
  expect(
    (await asB(`/products/${product.id}/prices`, "POST", { amount: 10000, reason: "Hijack" }))
      .status,
  ).toBe(404);
  const listed = (await (await asB(`/products?q=${product.sku}`)).json()) as { items: unknown[] };
  expect(listed.items).toHaveLength(0);
  expect(await (await call(`/products/${product.id}`)).json()).toMatchObject({
    name: product.name,
    archivedAt: null,
  });

  // The same sku and barcode are free in another organisation.
  const mirrored = await asB("/products", "POST", {
    sku: product.sku,
    name: "B copy",
    baseUnit: "each",
    taxClass: "standard",
    barcodes: [{ code }],
  });
  expect(mirrored.status).toBe(201);
});

test("inventory manager, accountant and cashier can read but not write; admin and super admin can write", async () => {
  for (const role of ["superadmin", "admin", "accountant", "inventory", "cashier"]) {
    const writer = role === "superadmin" || role === "admin";
    const code = barcode();
    const fixture = await createProduct({ barcodes: [{ code }] });
    const category = await postOk("/categories", { name: unique(`Matrix cat ${role}`) });
    const supplier = await postOk("/suppliers", { name: unique(`Matrix sup ${role}`) });
    const extra = barcode();
    const operations = [
      ["GET", "/products", undefined, 200, 200],
      ["GET", `/products/${fixture.id}`, undefined, 200, 200],
      ["GET", `/barcodes/${code}`, undefined, 200, 200],
      ["GET", "/categories", undefined, 200, 200],
      ["GET", "/suppliers", undefined, 200, 200],
      [
        "POST",
        "/products",
        { sku: unique("M"), name: "Matrix", baseUnit: "each", taxClass: "standard" },
        201,
        403,
      ],
      ["PATCH", `/products/${fixture.id}`, { name: `${role} rename` }, 200, 403],
      ["POST", `/products/${fixture.id}/barcodes`, { code: extra }, 201, 403],
      ["DELETE", `/products/${fixture.id}/barcodes/${extra}`, undefined, 204, 403],
      ["POST", "/categories", { name: unique(`Cat ${role}`) }, 201, 403],
      ["PATCH", `/categories/${category.id}`, { name: unique(`Renamed ${role}`) }, 200, 403],
      ["POST", "/suppliers", { name: unique(`Sup ${role}`) }, 201, 403],
      ["PATCH", `/suppliers/${supplier.id}`, { phone: "0244000000" }, 200, 403],
      [
        "POST",
        `/products/${fixture.id}/prices`,
        { amount: 10000, reason: `${role} price` },
        201,
        403,
      ],
      ["DELETE", `/products/${fixture.id}`, undefined, 204, 403],
    ] as const;
    for (const [method, path, body, allowed, denied] of operations) {
      const response = await call(path, method, body, role);
      const isWrite = method !== "GET";
      expect(response.status, `${role} ${method} ${path}`).toBe(
        isWrite && !writer ? denied : allowed,
      );
    }
  }
});
