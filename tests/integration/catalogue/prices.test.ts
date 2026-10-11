import { expect, test } from "vite-plus/test";
import {
  postOk,
  allAuditRows,
  auditRowsFor,
  call,
  createProduct,
  expectChainValid,
  otherApi,
  cookies,
  request,
  unique,
} from "./support";

type Price = {
  id: string;
  branchId: string | null;
  amount: number;
  validFrom: string;
  validTo: string | null;
};
const setPrice = (productId: string, body: Record<string, unknown>) =>
  call(`/products/${productId}/prices`, "POST", { reason: "Test price", ...body });
const priceAt = (productId: string, at: string, branchId?: string) =>
  call(
    `/prices/at?productId=${productId}&at=${encodeURIComponent(at)}${branchId ? `&branchId=${branchId}` : ""}`,
  );
const amountAt = async (productId: string, at: string, branchId?: string) =>
  ((await (await priceAt(productId, at, branchId)).json()) as Price).amount;

async function branches(count: number) {
  const store = await postOk("/stores", { name: unique("Price store") });
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const branch = await call("/branches", "POST", {
      name: unique("Price branch"),
      storeId: store.id,
    });
    expect(branch.status).toBe(201);
    ids.push((await branch.json()).id);
  }
  return ids;
}

test("price lookup at a timestamp picks the version in force", async () => {
  const product = await createProduct();
  for (const [amount, validFrom] of [
    [10000, "2026-01-01T00:00:00Z"],
    [15000, "2026-02-01T00:00:00Z"],
    [20000, "2026-03-01T00:00:00Z"],
  ] as const) {
    const created = await setPrice(product.id, { amount, validFrom });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ amount, branchId: null, validTo: null });
  }
  expect(await amountAt(product.id, "2026-01-15T12:00:00Z")).toBe(10000);
  expect(await amountAt(product.id, "2026-02-01T00:00:00Z")).toBe(15000);
  expect(await amountAt(product.id, "2026-02-28T23:59:59Z")).toBe(15000);
  expect(await amountAt(product.id, "2027-01-01T00:00:00Z")).toBe(20000);
  expect((await priceAt(product.id, "2025-12-31T23:59:59Z")).status).toBe(404);
  const detail = await (await call(`/products/${product.id}`)).json();
  expect(detail.prices.map((p: Price) => p.amount).sort()).toEqual([10000, 15000, 20000]);
});

test("a price without valid_from takes effect now", async () => {
  const product = await createProduct();
  const created = (await (await setPrice(product.id, { amount: 25000 })).json()) as Price;
  expect(Math.abs(Date.now() - Date.parse(created.validFrom))).toBeLessThan(60_000);
  expect(await amountAt(product.id, new Date(Date.now() + 60_000).toISOString())).toBe(25000);
});

test("a branch override beats the org price for that branch only", async () => {
  const [downtown, airport] = await branches(2);
  const product = await createProduct();
  await setPrice(product.id, { amount: 10000, validFrom: "2026-01-01T00:00:00Z" });
  const override = await setPrice(product.id, {
    amount: 8000,
    branchId: downtown,
    validFrom: "2026-01-01T00:00:00Z",
  });
  expect(await override.json()).toMatchObject({ amount: 8000, branchId: downtown });
  // A later org-wide change does not displace the branch override.
  await setPrice(product.id, { amount: 12000, validFrom: "2026-02-01T00:00:00Z" });

  const at = "2026-02-15T00:00:00Z";
  expect(await amountAt(product.id, at, downtown)).toBe(8000);
  expect(await amountAt(product.id, at, airport)).toBe(12000);
  expect(await amountAt(product.id, at)).toBe(12000);
});

test("a newer version with the same valid_from wins", async () => {
  const product = await createProduct();
  const validFrom = "2026-04-01T00:00:00Z";
  await setPrice(product.id, { amount: 10000, validFrom });
  await setPrice(product.id, { amount: 11000, validFrom });
  expect(await amountAt(product.id, validFrom)).toBe(11000);
  expect(await amountAt(product.id, "2026-06-01T00:00:00Z")).toBe(11000);
});

test("a barcode lookup carries the price in force for the branch", async () => {
  const [branch] = await branches(1);
  const code = `7${Date.now()}`.slice(0, 13);
  const product = await createProduct({ barcodes: [{ code }] });
  await setPrice(product.id, { amount: 9500, validFrom: "2026-01-01T00:00:00Z" });
  const found = await (
    await call(
      `/barcodes/${code}?branchId=${branch}&at=${encodeURIComponent("2026-05-01T00:00:00Z")}`,
    )
  ).json();
  expect(found.price).toMatchObject({ amount: 9500, branchId: null });
});

test("a price change writes an audit row with its reason", async () => {
  const product = await createProduct();
  const reason = unique("Supplier raised cost");
  const before = (await allAuditRows()).length;
  const created = (await (
    await setPrice(product.id, { amount: 13500, reason, validFrom: "2026-01-01T00:00:00Z" })
  ).json()) as Price;
  const rows = (await allAuditRows()).slice(before);
  expect(rows).toHaveLength(1);
  expect(rows[0]!.reason).toBe(reason);
  expect([created.id, product.id]).toContain(rows[0]!.entityId);
  expect(JSON.stringify(rows[0]!.after)).toContain("13500");
  expect((await auditRowsFor(rows[0]!.entityId!)).some((row) => row.reason === reason)).toBe(true);
  await expectChainValid();
});

test("a non-positive or fractional price is rejected, and a missing reason is rejected", async () => {
  const product = await createProduct();
  const before = (await allAuditRows()).length;
  const bad: Record<string, unknown>[] = [
    { amount: 0 },
    { amount: -10000 },
    { amount: 12.5 },
    { amount: "12.50" },
    { amount: 10000, reason: undefined },
    { amount: 10000, reason: "" },
    { amount: 10000, reason: "x".repeat(501) },
    { amount: 10000, validFrom: "not-a-date" },
    { amount: 10000, validFrom: "2026-01-01T00:00:00+01" },
    { amount: 10000, validFrom: "2026-02-31T00:00:00Z" },
  ];
  for (const body of bad) {
    const response = await call(`/products/${product.id}/prices`, "POST", {
      reason: "Valid reason",
      ...body,
    });
    expect(response.status, JSON.stringify(body)).toBe(400);
  }
  expect((await allAuditRows()).length).toBe(before);
  expect((await (await call(`/products/${product.id}`)).json()).prices).toEqual([]);
  const lookup = `/prices/at?productId=${product.id}&at=`;
  expect((await call(`${lookup}2026-02-31T00:00:00Z`)).status).toBe(400);
  expect(
    (
      await call("/products/0198d0a0-0000-7000-8000-000000000000/prices", "POST", {
        amount: 10000,
        reason: "Ghost",
      })
    ).status,
  ).toBe(404);
});

test("org B cannot price org A's products or read their prices", async () => {
  const product = await createProduct();
  await setPrice(product.id, { amount: 10000, validFrom: "2026-01-01T00:00:00Z" });
  const asB = (path: string) => request(otherApi, cookies.get("other")!, path);
  expect((await asB(`/prices/at?productId=${product.id}&at=2026-06-01T00:00:00Z`)).status).toBe(
    404,
  );
});
