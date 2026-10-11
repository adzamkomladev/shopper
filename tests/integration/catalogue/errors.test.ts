import { expect, test } from "vite-plus/test";
import { barcode, call, createProduct, unique } from "./support";

const valid = () => ({
  sku: unique("ERR"),
  name: "Error probe",
  baseUnit: "each",
  taxClass: "standard",
});
const problem = async (response: Response, status: number) => {
  expect(response.status).toBe(status);
  return (await response.json()) as { error: string; field?: string };
};

test("a duplicate SKU is a 409 that names the sku field", async () => {
  const first = await createProduct();
  const body = await problem(await call("/products", "POST", { ...valid(), sku: first.sku }), 409);
  expect(body.field).toBe("sku");
  expect(body.error).toEqual(expect.any(String));
});

test("a barcode already on another product is a 409 that names the barcodes field", async () => {
  const shared = barcode();
  await createProduct({ barcodes: [{ code: shared }] });
  const other = await createProduct();
  const created = await call("/products", "POST", { ...valid(), barcodes: [{ code: shared }] });
  expect((await problem(created, 409)).field).toBe("barcodes");
  const added = await call(`/products/${other.id}/barcodes`, "POST", { code: shared });
  expect((await problem(added, 409)).field).toBe("barcodes");
});

test("an invalid body is a 400 whose field is the failing path", async () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ ...valid(), name: "" }, "name"],
    [{ ...valid(), baseUnit: "lbs" }, "baseUnit"],
    [{ ...valid(), unexpected: true }, "unexpected"],
    [
      { ...valid(), barcodes: [{ code: barcode(), quantityThousandths: 0 }] },
      "barcodes.0.quantityThousandths",
    ],
  ];
  for (const [bad, field] of cases)
    expect((await problem(await call("/products", "POST", bad), 400)).field, field).toBe(field);

  const product = await createProduct();
  const patched = await call(`/products/${product.id}`, "PATCH", { taxClass: "reduced" });
  expect((await problem(patched, 400)).field).toBe("taxClass");
});
