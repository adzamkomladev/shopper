// scan: price labels keep the exact encoded gross (decimals 0-4) and derive quantity by integer ratio.
import { expect, test } from "vite-plus/test";
import { mulQty } from "@shopper/money";
import {
  ean13,
  fails,
  ids,
  label,
  layout,
  refPrice,
  refProduct,
  scan,
  seed,
  withTill,
} from "../../../../support/till/basket";

const priceCases: [string, number, string, number, number][] = [
  ["2 decimals", 2, "01250", 125_000, 10_417],
  ["no decimals", 0, "00005", 50_000, 4167],
  ["exact ratio", 2, "00180", 18_000, 1500],
  ["4 decimals", 4, "00500", 500, 42],
];
test.each(priceCases)(
  "price label, %s: the encoded gross is kept and quantity derived by rounding",
  async (_name, decimals, value, gross, quantity) => {
    await withTill(async (db) => {
      const product = refProduct({
        baseUnit: "kg",
        barcodes: [{ code: "00123", quantityThousandths: 1000 }],
      });
      await seed(db, {
        products: [product],
        prices: [
          refPrice(product.id, 10_000),
          refPrice(product.id, 12_000, { branchId: ids.branch }),
        ],
        mappings: [layout({ kind: "price", unit: undefined, decimals })],
      });
      const result = await scan(db, label(21, "00123", value));
      expect(result).toEqual({
        kind: "price",
        productId: product.id,
        quantityThousandths: quantity,
        gross,
      });
    });
  },
);

test("price label: the gross is never recomputed from unit price x derived quantity", async () => {
  await withTill(async (db) => {
    const product = refProduct({
      baseUnit: "kg",
      barcodes: [{ code: "00123", quantityThousandths: 1000 }],
    });
    await seed(db, {
      products: [product],
      prices: [refPrice(product.id, 12_000)],
      mappings: [layout({ kind: "price", unit: undefined, decimals: 2 })],
    });
    const result = await scan(db, label(21, "00123", "01250"));
    expect(mulQty(12_000 as never, result.quantityThousandths)).not.toBe(result.gross);
    expect(result.gross).toBe(125_000);
  });
});

test("price label: a half-way ratio rounds up", async () => {
  await withTill(async (db) => {
    const product = refProduct({ barcodes: [{ code: "00123", quantityThousandths: 1000 }] });
    await seed(db, {
      products: [product],
      prices: [refPrice(product.id, 2000)],
      mappings: [layout({ kind: "price", unit: undefined, decimals: 4 })],
    });
    expect(await scan(db, label(21, "00123", "00005"))).toMatchObject({
      gross: 5,
      quantityThousandths: 3,
    });
  });
});

test("price label: zero gross, rounds-to-zero quantity, no positive price and overflow are rejected", async () => {
  await withTill(async (db) => {
    const ok = refProduct({ barcodes: [{ code: "00123", quantityThousandths: 1000 }] });
    const free = refProduct({ barcodes: [{ code: "00124", quantityThousandths: 1000 }] });
    const unpriced = refProduct({ barcodes: [{ code: "00125", quantityThousandths: 1000 }] });
    const cheap = refProduct({ barcodes: [{ code: "7", quantityThousandths: 1000 }] });
    await seed(db, {
      products: [ok, free, unpriced, cheap],
      prices: [refPrice(ok.id, 10_000), refPrice(free.id, 0), refPrice(cheap.id, 1)],
      mappings: [
        layout({ prefix: 21, kind: "price", unit: undefined, decimals: 4 }),
        layout({
          prefix: 22,
          kind: "price",
          unit: undefined,
          decimals: 0,
          product: { start: 2, length: 1 },
          value: { start: 3, length: 9 },
        }),
      ],
    });
    await expect(scan(db, label(21, "00123", "00000"))).rejects.toMatchObject(
      fails("AMOUNT_INVALID"),
    );
    await expect(scan(db, label(21, "00123", "00001"))).rejects.toMatchObject(
      fails("QUANTITY_INVALID"),
    );
    await expect(scan(db, label(21, "00124", "00500"))).rejects.toMatchObject(
      fails("PRICE_MISSING"),
    );
    await expect(scan(db, label(21, "00125", "00500"))).rejects.toMatchObject(
      fails("PRICE_MISSING"),
    );
    await expect(scan(db, ean13("227999999999"))).rejects.toMatchObject(fails("QUANTITY_INVALID"));
  });
});
