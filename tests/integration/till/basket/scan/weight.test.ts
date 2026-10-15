// scan: weight labels convert g/kg and decimals to exact integer thousandths of the product unit.
import { expect, test } from "vite-plus/test";
import {
  fails,
  label,
  layout,
  refProduct,
  scan,
  seed,
  withTill,
} from "../../../../support/till/basket";

const weighCases: [string, "kg" | "g", "g" | "kg", number, string, number][] = [
  ["g label on a kg product", "kg", "g", 0, "01250", 1250],
  ["kg label, 3 decimals, kg product", "kg", "kg", 3, "01250", 1250],
  ["kg label, 2 decimals, kg product", "kg", "kg", 2, "00125", 1250],
  ["g label, 1 decimal, kg product", "kg", "g", 1, "12500", 1250],
  ["g label on a g product", "g", "g", 0, "00750", 750_000],
  ["kg label, 3 decimals, g product", "g", "kg", 3, "00750", 750_000],
];
test.each(weighCases)(
  "weight: %s resolves to exact thousandths",
  async (_name, base, unit, decimals, value, expected) => {
    await withTill(async (db) => {
      const product = refProduct({
        baseUnit: base,
        barcodes: [{ code: "00123", quantityThousandths: 1000 }],
      });
      await seed(db, { products: [product], mappings: [layout({ unit, decimals })] });
      const result = await scan(db, label(21, "00123", value));
      expect(result).toMatchObject({
        kind: "weight",
        productId: product.id,
        quantityThousandths: expected,
      });
      expect(result).not.toHaveProperty("gross");
    });
  },
);

test("weight: a non-exact conversion, a zero weight or a non-weighed unit is rejected", async () => {
  await withTill(async (db) => {
    const kg = refProduct({
      baseUnit: "kg",
      barcodes: [{ code: "00123", quantityThousandths: 1000 }],
    });
    const others = (["each", "l", "ml"] as const).map((baseUnit, i) =>
      refProduct({ baseUnit, barcodes: [{ code: `0099${i}`, quantityThousandths: 1000 }] }),
    );
    await seed(db, {
      products: [kg, ...others],
      mappings: [
        layout({ prefix: 21, unit: "g", decimals: 1 }),
        layout({ prefix: 22, unit: "kg", decimals: 4 }),
      ],
    });
    await expect(scan(db, label(21, "00123", "00015"))).rejects.toMatchObject(
      fails("QUANTITY_INVALID"),
    );
    await expect(scan(db, label(22, "00123", "00015"))).rejects.toMatchObject(
      fails("QUANTITY_INVALID"),
    );
    await expect(scan(db, label(21, "00123", "00000"))).rejects.toMatchObject(
      fails("QUANTITY_INVALID"),
    );
    for (let i = 0; i < others.length; i++)
      await expect(scan(db, label(21, `0099${i}`, "01000"))).rejects.toMatchObject(
        fails("UNIT_INVALID"),
      );
  });
});
