// final_sale marks a product that cannot be returned. It defaults to false, round-trips through the API and is audited.
import { expect, test } from "vite-plus/test";
import { auditRowsFor, call, createProduct } from "./support";

const read = async (id: string) => (await call(`/products/${id}`)).json();

test("a product is not final sale unless it says so", async () => {
  const product = await createProduct();
  expect(product.finalSale).toBe(false);
});

test("finalSale is created, read back, switched off and on again, with every change audited", async () => {
  const created = await createProduct({ finalSale: true });
  expect(created.finalSale).toBe(true);
  expect(await read(created.id)).toMatchObject({ finalSale: true });

  const off = await call(`/products/${created.id}`, "PATCH", { finalSale: false });
  expect(off.status).toBe(200);
  expect(await off.json()).toMatchObject({ finalSale: false });
  await call(`/products/${created.id}`, "PATCH", { finalSale: true });
  expect(await read(created.id)).toMatchObject({ finalSale: true });

  const rows = await auditRowsFor(created.id);
  expect(rows).toHaveLength(3);
  expect(rows[0]!.after).toMatchObject({ finalSale: true });
  expect(rows[1]).toMatchObject({ before: { finalSale: true }, after: { finalSale: false } });
});

test("finalSale must be a boolean", async () => {
  const product = await createProduct();
  expect((await call(`/products/${product.id}`, "PATCH", { finalSale: "yes" })).status).toBe(400);
});
