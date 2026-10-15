// scan: exact barcodes win, embedded labels need a checksum, a configured prefix and an exact product code.
// resolveScan(db, { orgId, branchId, code, at }) returns { kind: "barcode" | "weight" | "price", productId,
// quantityThousandths, gross? (price labels only) } and is read-only. TillError codes: CHECKSUM_INVALID,
// MAPPING_MISSING, PRODUCT_UNKNOWN, UNIT_INVALID, QUANTITY_INVALID, AMOUNT_INVALID, PRICE_MISSING.

import { expect, test } from "vite-plus/test";
import {
  bareCode,
  fails,
  label,
  layout,
  refPrice,
  refProduct,
  scan,
  seed,
  tableCounts,
  withTill,
} from "../../../../support/till/basket";

test("an exact product barcode resolves with its pack quantity, leading zeros kept", async () => {
  await withTill(async (db) => {
    const pack = refProduct({
      barcodes: [
        { code: bareCode, quantityThousandths: 12_000 },
        { code: "0012345", quantityThousandths: 1000 },
      ],
    });
    await seed(db, {
      products: [pack, refProduct({ barcodes: [{ code: "12345", quantityThousandths: 1000 }] })],
    });
    expect(await scan(db, bareCode)).toMatchObject({
      kind: "barcode",
      productId: pack.id,
      quantityThousandths: 12_000,
    });
    expect(await scan(db, "0012345")).toMatchObject({ kind: "barcode", productId: pack.id });
    expect(await scan(db, bareCode)).not.toHaveProperty("gross");
  });
});

test("an exact barcode wins even when it looks like an embedded label with a bad checksum", async () => {
  await withTill(async (db) => {
    const labelled = label(21, "00123", "00500");
    const bad = `${labelled.slice(0, 12)}${(Number(labelled[12]) + 1) % 10}`;
    const exact = refProduct({ barcodes: [{ code: bad, quantityThousandths: 2000 }] });
    const weighed = refProduct({
      baseUnit: "kg",
      barcodes: [{ code: "00123", quantityThousandths: 1000 }],
    });
    await seed(db, { products: [exact, weighed], mappings: [layout()] });
    expect(await scan(db, bad)).toMatchObject({
      kind: "barcode",
      productId: exact.id,
      quantityThousandths: 2000,
    });
    await expect(scan(db, labelled)).resolves.toMatchObject({
      kind: "weight",
      productId: weighed.id,
    });
    const own = refProduct({ barcodes: [{ code: labelled, quantityThousandths: 3000 }] });
    await seed(db, { products: [own] });
    expect(await scan(db, labelled)).toMatchObject({
      kind: "barcode",
      productId: own.id,
      quantityThousandths: 3000,
    });
  });
});

test("an embedded label needs a valid EAN-13 checksum and a configured prefix", async () => {
  await withTill(async (db) => {
    const kg = refProduct({
      baseUnit: "kg",
      barcodes: [{ code: "00123", quantityThousandths: 1000 }],
    });
    await seed(db, { products: [kg], mappings: [layout({ prefix: 21 })] });
    const good = label(21, "00123", "00500");
    expect(await scan(db, good)).toMatchObject({ kind: "weight", quantityThousandths: 500 });
    const bad = `${good.slice(0, 12)}${(Number(good[12]) + 1) % 10}`;
    await expect(scan(db, bad)).rejects.toMatchObject(fails("CHECKSUM_INVALID"));
    await expect(scan(db, label(22, "00123", "00500"))).rejects.toMatchObject(
      fails("MAPPING_MISSING", /22/),
    );
    for (const other of ["210012300500", "30012300500123", "21001230050AB", ""])
      await expect(scan(db, other)).rejects.toMatchObject(fails("PRODUCT_UNKNOWN"));
  });
  await withTill(async (db) => {
    await seed(db, { products: [refProduct({ baseUnit: "kg" })] });
    await expect(scan(db, label(21, "00123", "00500"))).rejects.toMatchObject(
      fails("MAPPING_MISSING"),
    );
  });
});

test("the embedded product code is matched to a product barcode record exactly", async () => {
  await withTill(async (db) => {
    const stripped = refProduct({
      baseUnit: "kg",
      barcodes: [{ code: "123", quantityThousandths: 1000 }],
    });
    const padded = refProduct({
      baseUnit: "kg",
      barcodes: [{ code: "00123", quantityThousandths: 1000 }],
    });
    const archived = refProduct({
      baseUnit: "kg",
      archivedAt: "2025-01-01T00:00:00.000Z",
      barcodes: [{ code: "00777", quantityThousandths: 1000 }],
    });
    await seed(db, { products: [stripped, padded, archived], mappings: [layout()] });
    expect(await scan(db, label(21, "00123", "00500"))).toMatchObject({ productId: padded.id });
    await expect(scan(db, label(21, "00124", "00500"))).rejects.toMatchObject(
      fails("PRODUCT_UNKNOWN", /00124/),
    );
    await expect(scan(db, label(21, "00777", "00500"))).rejects.toMatchObject(
      fails("PRODUCT_UNKNOWN"),
    );
  });
});

test("scans never write: successes and every error leave all tables untouched", async () => {
  await withTill(async (db) => {
    const product = refProduct({
      baseUnit: "kg",
      barcodes: [
        { code: "00123", quantityThousandths: 1000 },
        { code: bareCode, quantityThousandths: 1000 },
      ],
    });
    await seed(db, {
      products: [product],
      prices: [refPrice(product.id, 12_000)],
      mappings: [layout(), layout({ prefix: 23, kind: "price", unit: undefined, decimals: 2 })],
    });
    const before = await tableCounts(db);
    const codes = [
      bareCode,
      label(21, "00123", "00500"),
      label(23, "00123", "00500"),
      label(21, "00123", "00000"),
      label(24, "00123", "00500"),
      "999",
      `${label(21, "00123", "00500").slice(0, 12)}0`,
    ];
    for (const code of codes) await scan(db, code).catch(() => undefined);
    expect(await tableCounts(db)).toEqual(before);
  });
});
