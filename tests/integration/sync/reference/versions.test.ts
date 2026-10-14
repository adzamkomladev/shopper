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
  expect(decoded).toMatchObject({ v: 2, entity: "product", op: "upsert" });
  expect(decoded.payload).toEqual({ ...product, barcodes });
});

test("a v2 product row without barcodes is rejected rather than defaulted", () => {
  expect(decodeReferenceChange(change(2, { ...product, barcodes })).v).toBe(2);
  expect(() => decodeReferenceChange(change(2, product))).toThrow();
});

test("a v1 product row upcasts to v2 with empty barcodes", () => {
  const decoded = decodeReferenceChange(change(1, product));
  expect(decoded.v).toBe(2);
  expect(decoded.payload).toEqual({ ...product, barcodes: [] });
});

test("a v1 delete row upcasts without inventing product fields", () => {
  const decoded = decodeReferenceChange(change(1, { id: productId }, "product", "delete"));
  expect(decoded).toMatchObject({ v: 2, op: "delete", payload: { id: productId } });
});

test("a v2 mapping row decodes", () => {
  const decoded = decodeReferenceChange(change(2, mapping, "barcode-mapping"));
  expect(decoded).toMatchObject({ v: 2, entity: "barcode-mapping", payload: mapping });
});

test("a v2 snapshot decodes with products' barcodes and the mappings", () => {
  const raw = snapshot(2, {
    ...empty,
    products: [{ ...product, barcodes }],
    barcodeMappings: [mapping],
  });
  const decoded = decodeSnapshot(raw);
  expect(decoded.v).toBe(2);
  expect(decoded.reference.products).toEqual([{ ...product, barcodes }]);
  expect(decoded.reference.barcodeMappings).toEqual([mapping]);
});

test("a v1 snapshot upcasts: products get no barcodes and there are no mappings", () => {
  const decoded = decodeSnapshot(snapshot(1, { ...empty, products: [product] }));
  expect(decoded).toMatchObject({ v: 2, orgId, cursor: "12" });
  expect(decoded.reference.products).toEqual([{ ...product, barcodes: [] }]);
  expect(decoded.reference.barcodeMappings).toEqual([]);
});

test("unsupported versions are refused", () => {
  expect(decodeReferenceChange(change(2, { ...product, barcodes })).v).toBe(2);
  for (const version of [3, 0]) {
    expect(() => decodeReferenceChange(change(version, { ...product, barcodes }))).toThrow();
    expect(() =>
      decodeSnapshot(snapshot(version, { ...empty, products: [], barcodeMappings: [] })),
    ).toThrow();
  }
});
