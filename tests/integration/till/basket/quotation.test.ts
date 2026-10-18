// quoteLine(db, { orgId, branchId, productId, quantityThousandths, at }) is the shared, read-only quotation:
// effective price (branch beats org) + dated Ghana tax rule + snapshotLine. It returns the sale-line fields
// recordLocalSale stores (productId, priceId, sku, name, baseUnit, tax) without an id, and throws TillError
// with code PRODUCT_UNKNOWN, PRICE_MISSING, TAX_RULE_MISSING or QUANTITY_INVALID.
import { expect, test } from "vite-plus/test";
import { quoteLine, recordLocalSale, provisionTillReference } from "@shopper/core/till";
import {
  at,
  config,
  context,
  goldenSale,
  ids,
  refPrice,
  refProduct,
  references,
  seed,
  session,
  tableCounts,
  withTill,
} from "../../../support/till/basket";

const quote = (db: Parameters<typeof quoteLine>[0], over: Record<string, unknown> = {}) =>
  quoteLine(db, {
    orgId: ids.org,
    branchId: ids.branch,
    productId: ids.product,
    quantityThousandths: goldenSale.quantityThousandths,
    at,
    ...over,
  });
const v7Unknown = "019a0000-0000-7000-8000-0000000000aa";
const golden = (db: Parameters<typeof quoteLine>[0]) =>
  provisionTillReference(db, context, references);
const failure = (code: string, message?: RegExp) => ({
  name: "TillError",
  code,
  ...(message ? { message: expect.stringMatching(message) } : {}),
});

test("the quote equals the line recordLocalSale stores for the golden sale, to the last unit", async () => {
  await withTill(async (db) => {
    await golden(db);
    const quoted = await quote(db);
    expect(quoted).toMatchObject({
      productId: ids.product,
      priceId: ids.branchPrice,
      sku: "MILK-001",
      name: "Fresh milk",
      baseUnit: "each",
      tax: { on: goldenSale.on, unitPrice: goldenSale.unitPrice, ...goldenSale.line },
    });
    const event = await recordLocalSale(db, config, session, {
      lines: [{ productId: ids.product, quantityThousandths: goldenSale.quantityThousandths }],
    });
    const { id: _id, ...stored } = event.sale.lines[0]!;
    expect(stored).toEqual({
      ...quoted,
      discount: quoted.tax.discount,
      label: null,
      override: null,
    });
  });
});

test("quoting reads only: no sale, outbox, audit or state row changes", async () => {
  await withTill(async (db) => {
    await golden(db);
    const before = await tableCounts(db);
    await quote(db);
    await expect(quote(db, { productId: v7Unknown })).rejects.toBeDefined();
    expect(await tableCounts(db)).toEqual(before);
  });
});
test("a branch price beats the organisation price and other branches fall back to it", async () => {
  await withTill(async (db) => {
    await golden(db);
    expect(await quote(db)).toMatchObject({ priceId: ids.branchPrice, tax: { unitPrice: 12_000 } });
    const other = await quote(db, { branchId: "019a0000-0000-7000-8000-0000000000bb" });
    expect(other).toMatchObject({
      priceId: ids.basePrice,
      tax: { unitPrice: 10_000, gross: 15_000 },
    });
  });
});

test("price validity is inclusive at validFrom and exclusive at validTo", async () => {
  await withTill(async (db) => {
    await golden(db);
    const from = new Date("2025-06-01T00:00:00.000Z");
    expect(await quote(db, { at: new Date(from.valueOf() - 1) })).toMatchObject({
      priceId: ids.basePrice,
    });
    expect(await quote(db, { at: from })).toMatchObject({ priceId: ids.branchPrice });
  });
  await withTill(async (db) => {
    const product = refProduct();
    const price = refPrice(product.id, 5000, {
      validFrom: "2025-03-01T00:00:00.000Z",
      validTo: "2025-04-01T00:00:00.000Z",
    });
    await seed(db, { products: [product], prices: [price] });
    const at1 = (iso: string) =>
      quote(db, { productId: product.id, quantityThousandths: 1000, at: new Date(iso) });
    expect(await at1("2025-03-01T00:00:00.000Z")).toMatchObject({ priceId: price.id });
    expect(await at1("2025-03-31T23:59:59.999Z")).toMatchObject({ priceId: price.id });
    await expect(at1("2025-04-01T00:00:00.000Z")).rejects.toMatchObject(failure("PRICE_MISSING"));
    await expect(at1("2025-02-28T23:59:59.999Z")).rejects.toMatchObject(failure("PRICE_MISSING"));
  });
});

test("the tax rule follows the Ghana calendar date at the quote time", async () => {
  await withTill(async (db) => {
    await golden(db);
    const last = await quote(db, { at: new Date("2025-12-31T23:59:59.999Z") });
    expect(last.tax).toMatchObject({
      on: "2025-12-31",
      rule: { id: ids.oldTax },
      vat: 2250,
      gross: 18_000,
    });
    const first = await quote(db, { at: new Date("2026-01-01T00:00:00.000Z") });
    expect(first.tax).toMatchObject({
      on: "2026-01-01",
      rule: { id: ids.currentTax },
      base: 16_364,
      vat: 1636,
      nhil: 0,
      gross: 18_000,
    });
  });
});

test("zero-rated and exempt products carry no tax", async () => {
  await withTill(async (db) => {
    const zero = refProduct({ taxClass: "zero-rated" });
    const exempt = refProduct({ taxClass: "exempt" });
    await seed(db, {
      products: [zero, exempt],
      prices: [refPrice(zero.id, 2500), refPrice(exempt.id, 2500)],
    });
    for (const product of [zero, exempt])
      expect(await quote(db, { productId: product.id, quantityThousandths: 2500 })).toMatchObject({
        tax: {
          taxClass: product.taxClass,
          unitPrice: 2500,
          base: 6250,
          vat: 0,
          nhil: 0,
          getfund: 0,
          covid: 0,
          gross: 6250,
          roundingAdjustment: 0,
        },
      });
  });
});

test("fractional quantities round the gross half-up on integers", async () => {
  await withTill(async (db) => {
    await golden(db);
    const quoted = await quote(db, { quantityThousandths: 333 });
    expect(quoted.tax).toMatchObject({ quantityThousandths: 333, gross: 3996 });
    expect(
      Object.values(quoted.tax)
        .filter((x) => typeof x === "number")
        .every(Number.isSafeInteger),
    ).toBe(true);
  });
});

test("a missing, archived or foreign product is PRODUCT_UNKNOWN naming the product", async () => {
  await withTill(async (db) => {
    const archived = refProduct({ archivedAt: "2025-05-01T00:00:00.000Z" });
    await seed(db, { products: [archived], prices: [refPrice(archived.id, 100)] });
    await golden(db);
    for (const productId of [v7Unknown, archived.id])
      await expect(quote(db, { productId })).rejects.toMatchObject(
        failure("PRODUCT_UNKNOWN", new RegExp(productId)),
      );
    await expect(quote(db, { orgId: ids.otherOrg })).rejects.toMatchObject(
      failure("PRODUCT_UNKNOWN"),
    );
  });
});

test("a product without an effective price is PRICE_MISSING, a date without a rule is TAX_RULE_MISSING", async () => {
  await withTill(async (db) => {
    const unpriced = refProduct();
    const priced = refProduct();
    await seed(db, { products: [unpriced, priced], prices: [refPrice(priced.id, 100)] });
    await expect(quote(db, { productId: unpriced.id })).rejects.toMatchObject(
      failure("PRICE_MISSING", new RegExp(unpriced.id)),
    );
    await expect(
      quote(db, { productId: priced.id, at: new Date("2024-12-31T23:59:59.999Z") }),
    ).rejects.toMatchObject(failure("TAX_RULE_MISSING", /2024-12-31/));
    expect(await quote(db, { productId: priced.id })).toMatchObject({ productId: priced.id });
  });
});

test("a zero, negative or fractional quantity is QUANTITY_INVALID", async () => {
  await withTill(async (db) => {
    await golden(db);
    for (const quantityThousandths of [0, -1000, 1.5, Number.NaN])
      await expect(quote(db, { quantityThousandths })).rejects.toMatchObject(
        failure("QUANTITY_INVALID"),
      );
  });
});
