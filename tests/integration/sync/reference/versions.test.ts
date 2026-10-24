// Slice 2: reference rows and snapshots are versioned; v1 upcasts explicitly and unknown versions are refused.
import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { decodeReferenceChange, decodeSnapshot } from "@shopper/core/schemas";

const orgId = v7();
const productId = v7();
const product = {
  id: productId,
  orgId,
  sku: "SKU-1",
  name: "Milo",
  baseUnit: "each",
  taxClass: "standard",
  archivedAt: null,
};
const barcodes = [{ code: "0012345", quantityThousandths: 1000 }];
const mapping = {
  id: v7(),
  prefix: 21,
  product: { start: 2, length: 5 },
  value: { start: 7, length: 5 },
  kind: "weight",
  unit: "g",
  decimals: 0,
};
const change = (version: number, payload: unknown, entity = "product", op = "upsert") => ({
  seq: "7",
  id: v7(),
  entity,
  entityId: productId,
  op,
  v: version,
  payload,
});
const snapshot = (version: number, reference: unknown) => ({
  v: version,
  orgId,
  storeId: v7(),
  cursor: "12",
  reference,
});
const empty = { prices: [], taxRules: [] };

test("a v2 product row decodes with its barcodes untouched", () => {
  const decoded = decodeReferenceChange(change(2, { ...product, barcodes }));
  expect(decoded).toMatchObject({ v: 5, entity: "product", op: "upsert" });
  expect(decoded.payload).toEqual({ ...product, barcodes, finalSale: false });
});

test("a v3 product row keeps its finalSale flag", () => {
  const decoded = decodeReferenceChange(change(3, { ...product, barcodes, finalSale: true }));
  expect(decoded).toMatchObject({ v: 5, payload: { finalSale: true } });
});

test("a v2 product row without barcodes is rejected rather than defaulted", () => {
  expect(decodeReferenceChange(change(2, { ...product, barcodes })).v).toBe(5);
  expect(() => decodeReferenceChange(change(2, product))).toThrow();
});

test("a v1 product row upcasts to v4 with empty barcodes and not final sale", () => {
  const decoded = decodeReferenceChange(change(1, product));
  expect(decoded.v).toBe(5);
  expect(decoded.payload).toEqual({ ...product, barcodes: [], finalSale: false });
});

test("a v1 delete row upcasts without inventing product fields", () => {
  const decoded = decodeReferenceChange(change(1, { id: productId }, "product", "delete"));
  expect(decoded).toMatchObject({ v: 5, op: "delete", payload: { id: productId } });
});

test("a v2 mapping row decodes", () => {
  const decoded = decodeReferenceChange(change(2, mapping, "barcode-mapping"));
  expect(decoded).toMatchObject({ v: 5, entity: "barcode-mapping", payload: mapping });
});

test("a v2 snapshot decodes with products' barcodes and the mappings", () => {
  const raw = snapshot(2, {
    ...empty,
    products: [{ ...product, barcodes }],
    barcodeMappings: [mapping],
  });
  const decoded = decodeSnapshot(raw);
  expect(decoded.v).toBe(5);
  expect(decoded.reference.products).toEqual([{ ...product, barcodes, finalSale: false }]);
  expect(decoded.reference.barcodeMappings).toEqual([mapping]);
});

test("a v1 snapshot upcasts: products get no barcodes and there are no mappings", () => {
  const decoded = decodeSnapshot(snapshot(1, { ...empty, products: [product] }));
  expect(decoded).toMatchObject({ v: 5, orgId, cursor: "12" });
  expect(decoded.reference.products).toEqual([{ ...product, barcodes: [], finalSale: false }]);
  expect(decoded.reference.barcodeMappings).toEqual([]);
});

test("unsupported versions are refused", () => {
  expect(decodeReferenceChange(change(5, { ...product, barcodes })).v).toBe(5);
  for (const version of [6, 0]) {
    expect(() => decodeReferenceChange(change(version, { ...product, barcodes }))).toThrow();
    expect(() =>
      decodeSnapshot(snapshot(version, { ...empty, products: [], barcodeMappings: [] })),
    ).toThrow();
  }
});

const person = {
  id: v7(),
  orgId,
  name: "Ama Mensah",
  phone: "0241234567",
  kind: "individual",
  businessName: null,
  tin: null,
  version: 1,
  archivedAt: null,
  mergedIntoId: null,
};
const customerChange = (payload: unknown, op = "upsert") => change(4, payload, "customer", op);

test("a v4 customer row decodes with its lookup fields and nothing about money", () => {
  const decoded = decodeReferenceChange(customerChange(person));
  expect(decoded).toMatchObject({ v: 5, entity: "customer", op: "upsert", payload: person });
  expect(() =>
    decodeReferenceChange(customerChange({ ...person, creditLimit: 5_000_000 })),
  ).toThrow();
  expect(() => decodeReferenceChange(customerChange({ ...person, phone: "12" }))).toThrow();
  expect(decodeReferenceChange(customerChange({ id: person.id }, "delete"))).toMatchObject({
    v: 5,
    op: "delete",
  });
});

test("a v3 snapshot upcasts to v4 with no customers, a v4 snapshot carries them", () => {
  const v3 = decodeSnapshot(
    snapshot(3, { ...empty, products: [{ ...product, barcodes }], barcodeMappings: [mapping] }),
  );
  expect(v3.v).toBe(5);
  expect(v3.reference.customers).toEqual([]);
  expect(v3.reference.products).toEqual([{ ...product, barcodes, finalSale: false }]);
  const v4 = decodeSnapshot(
    snapshot(4, { ...empty, products: [], barcodeMappings: [], customers: [person] }),
  );
  expect(v4.reference.customers).toEqual([person]);
  expect(() =>
    decodeSnapshot(snapshot(4, { ...empty, products: [], barcodeMappings: [] })),
  ).toThrow();
});

const settings = {
  id: orgId,
  cashRounding: "none",
  priceMode: "exclusive",
  vatRegisteredFrom: "2026-03-01",
  tin: "C0012345678",
};

test("a v5 org-setting row decodes, and a malformed one is refused", () => {
  const decoded = decodeReferenceChange({ ...change(5, settings, "org-setting"), entityId: orgId });
  expect(decoded).toMatchObject({ v: 5, entity: "org-setting", payload: settings });
  expect(() =>
    decodeReferenceChange(change(5, { ...settings, priceMode: "net" }, "org-setting")),
  ).toThrow();
});

test("a v4 snapshot's rounding becomes the v5 settings, with the pre-v5 tax defaults", () => {
  const base = { ...empty, products: [], barcodeMappings: [], customers: [] };
  const upcast = decodeSnapshot(snapshot(4, { ...base, cashRounding: "none" }));
  expect(upcast.v).toBe(5);
  expect(upcast.reference.settings).toEqual({
    id: orgId,
    cashRounding: "none",
    priceMode: "inclusive",
    vatRegisteredFrom: "2026-01-01",
    tin: null,
  });
  expect(decodeSnapshot(snapshot(4, base)).reference.settings.cashRounding).toBe("10p");
  expect(decodeSnapshot(snapshot(5, { ...base, settings })).reference.settings).toEqual(settings);
  expect(() => decodeSnapshot(snapshot(5, base))).toThrow();
});
