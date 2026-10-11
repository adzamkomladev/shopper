import { expect, test } from "vite-plus/test";
import { postOk, allAuditRows, auditRowsFor, call, createProduct, unique } from "./support";

test("categories and suppliers are unique by name regardless of case", async () => {
  const name = unique("Beverages");
  const created = await call("/categories", "POST", { name });
  expect(created.status).toBe(201);
  const category = await created.json();
  const before = (await allAuditRows()).length;
  expect((await call("/categories", "POST", { name: name.toUpperCase() })).status).toBe(409);

  const child = await call("/categories", "POST", { name, parentId: category.id });
  expect(child.status, "same name under another parent is allowed").toBe(201);
  expect(
    (await call("/categories", "POST", { name: name.toLowerCase(), parentId: category.id })).status,
  ).toBe(409);
  const other = await postOk("/categories", { name: unique("Snacks") });
  expect(
    (await call(`/categories/${other.id}`, "PATCH", { name: name.toLowerCase() })).status,
  ).toBe(409);
  expect((await allAuditRows()).length).toBe(before + 2); // the child and "Snacks" categories; the 409s add none

  const supplierName = unique("Accra Wholesale");
  const supplier = await call("/suppliers", "POST", {
    name: supplierName,
    phone: "0302000000",
    email: "sales@accra.example",
    tin: "C0001234567",
  });
  expect(supplier.status).toBe(201);
  expect(await supplier.json()).toMatchObject({
    name: supplierName,
    phone: "0302000000",
    email: "sales@accra.example",
    tin: "C0001234567",
  });
  expect((await call("/suppliers", "POST", { name: supplierName.toUpperCase() })).status).toBe(409);
});

test("categories and suppliers can be listed, renamed and used on a product", async () => {
  const category = await postOk("/categories", { name: unique("Dairy") });
  const supplier = await postOk("/suppliers", { name: unique("Kasapreko") });
  const renamed = unique("Dairy and Eggs");
  const patched = await call(`/categories/${category.id}`, "PATCH", { name: renamed });
  expect(patched.status).toBe(200);
  expect(await patched.json()).toMatchObject({ id: category.id, name: renamed });
  expect(
    await (await call(`/suppliers/${supplier.id}`, "PATCH", { phone: "0244123456" })).json(),
  ).toMatchObject({ id: supplier.id, phone: "0244123456" });

  const categories = await (await call("/categories")).json();
  expect(categories.map((c: { id: string }) => c.id)).toContain(category.id);
  const suppliers = await (await call("/suppliers")).json();
  expect(suppliers.map((s: { id: string }) => s.id)).toContain(supplier.id);

  const product = await createProduct({ categoryId: category.id, supplierId: supplier.id });
  expect(product).toMatchObject({ categoryId: category.id, supplierId: supplier.id });
  const audit = await auditRowsFor(category.id);
  expect(audit).toHaveLength(2);
  expect(audit[1]!.before).toMatchObject({ name: expect.any(String) });
  expect(audit[1]!.after).toMatchObject({ name: renamed });
});

test("invalid or unknown reference data is rejected", async () => {
  expect((await call("/categories", "POST", { name: "" })).status).toBe(400);
  expect((await call("/suppliers", "POST", {})).status).toBe(400);
  expect(
    (await call("/categories/0198d0a0-0000-7000-8000-000000000000", "PATCH", { name: "Ghost" }))
      .status,
  ).toBe(404);
  expect(
    (await call("/suppliers/0198d0a0-0000-7000-8000-000000000000", "PATCH", { name: "Ghost" }))
      .status,
  ).toBe(404);
});

test("categories stay two levels deep and never parent themselves", async () => {
  const department = await postOk("/categories", { name: unique("Groceries") });
  const child = await postOk("/categories", { name: unique("Rice"), parentId: department.id });
  const self = await call(`/categories/${department.id.toUpperCase()}`, "PATCH", {
    parentId: department.id,
  });
  expect(self.status).toBe(400);
  expect(
    (await call("/categories", "POST", { name: unique("Basmati"), parentId: child.id })).status,
    "a category under a category under a department is too deep",
  ).toBe(400);
  expect(
    (await call(`/categories/${department.id}`, "PATCH", { parentId: child.id })).status,
    "a department with children cannot move under one of them",
  ).toBe(400);
});
