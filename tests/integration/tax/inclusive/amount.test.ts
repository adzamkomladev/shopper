// snapshotAmount({ rule, on, taxClass, priceMode: "inclusive", gross, quantityThousandths, unitPrice })
// extracts the tax breakdown from an authoritative gross. unitPrice and quantityThousandths are recorded
// as given (a price-embedded label's gross need not equal unitPrice x quantity). It returns the same
// frozen shape as snapshotLine, with discount 0, and rejects exclusive mode, negative or fractional gross.
import { expect, test } from "vite-plus/test";
import { mulQty, type Money } from "@shopper/money";
import { snapshotAmount, snapshotLine, type TaxClass, type TaxRule } from "@shopper/tax";
import { goldenSale, references } from "../../../fixtures/sales/golden";

const [oldRule, currentRule]: TaxRule[] = references.taxRules;
const covidRule = { ...oldRule, id: "019a0000-0000-7000-8000-0000000000ff", covidBps: 100 };
const rules = [oldRule, currentRule, covidRule];
const classes: TaxClass[] = ["standard", "zero-rated", "exempt"];
const on = "2026-01-02";
const base = {
  rule: currentRule,
  on,
  taxClass: "standard",
  priceMode: "inclusive",
  registered: true,
} as const;
const amount = (over: Partial<Parameters<typeof snapshotAmount>[0]> = {}) =>
  snapshotAmount({
    ...base,
    gross: 10_005 as Money,
    unitPrice: 10_005 as Money,
    quantityThousandths: 1000,
    ...over,
  });

test("the golden line gross yields the golden breakdown", () => {
  const gross = mulQty(goldenSale.unitPrice as Money, goldenSale.quantityThousandths);
  expect(gross).toBe(goldenSale.line.gross);
  const snapshot = snapshotAmount({
    rule: oldRule,
    on: goldenSale.on,
    taxClass: "standard",
    priceMode: "inclusive",
    registered: true,
    gross,
    unitPrice: goldenSale.unitPrice as Money,
    quantityThousandths: goldenSale.quantityThousandths,
  });
  expect(snapshot).toMatchObject({
    ...goldenSale.line,
    on: goldenSale.on,
    taxClass: "standard",
    priceMode: "inclusive",
    unitPrice: goldenSale.unitPrice,
    quantityThousandths: goldenSale.quantityThousandths,
    discount: 0,
    rule: { id: oldRule.id, effectiveFrom: oldRule.effectiveFrom },
  });
});

test("snapshotLine equals snapshotAmount of the line gross across classes, rules, quantities and prices", () => {
  const prices = [1, 99, 10_000, 12_345, 99_999, 1_234_567];
  const quantities = [1, 333, 999, 1000, 1500, 2750, 999_999];
  let cases = 0;
  for (const rule of rules)
    for (const taxClass of classes)
      for (const unitPrice of prices as Money[])
        for (const quantityThousandths of quantities) {
          const line = {
            rule,
            on,
            taxClass,
            priceMode: "inclusive",
            registered: true,
            unitPrice,
            quantityThousandths,
          } as const;
          const expected = snapshotLine(line);
          const actual = snapshotAmount({ ...line, gross: mulQty(unitPrice, quantityThousandths) });
          expect(
            actual,
            JSON.stringify({ rule: rule.id, taxClass, unitPrice, quantityThousandths }),
          ).toEqual(expected);
          for (const value of Object.values(actual))
            if (typeof value === "number") expect(Number.isSafeInteger(value)).toBe(true);
          cases += 1;
        }
  expect(cases).toBe(rules.length * classes.length * prices.length * quantities.length);
});

test("zero-rated and exempt grosses carry no tax and the whole gross is the base", () => {
  for (const taxClass of ["zero-rated", "exempt"] as const)
    expect(amount({ taxClass, gross: 7_777 as Money })).toMatchObject({
      taxClass,
      base: 7_777,
      vat: 0,
      nhil: 0,
      getfund: 0,
      covid: 0,
      gross: 7_777,
      roundingAdjustment: 0,
    });
});

test("an authoritative gross is preserved even when it differs from unit price x quantity", () => {
  const snapshot = amount({
    rule: oldRule,
    gross: 5000 as Money,
    unitPrice: 12_000 as Money,
    quantityThousandths: 4167,
  });
  expect(snapshot).toMatchObject({
    base: 4167,
    vat: 625,
    nhil: 104,
    getfund: 104,
    gross: 5000,
    roundingAdjustment: 0,
    unitPrice: 12_000,
    quantityThousandths: 4167,
    discount: 0,
  });
});

test("rounding drift is booked as roundingAdjustment so the components plus it equal the gross", () => {
  const snapshot = amount({ rule: oldRule, gross: 10_001 as Money });
  expect(snapshot).toMatchObject({
    base: 8334,
    vat: 1250,
    nhil: 208,
    getfund: 208,
    gross: 10_001,
    roundingAdjustment: 1,
  });
  const parts = snapshot.base + snapshot.vat + snapshot.nhil + snapshot.getfund + snapshot.covid;
  expect(parts + snapshot.roundingAdjustment).toBe(snapshot.gross);
  expect(amount({ gross: 10_005 as Money })).toMatchObject({
    base: 9095,
    vat: 910,
    roundingAdjustment: 0,
  });
});

test("a zero gross is a valid zero breakdown", () => {
  expect(amount({ gross: 0 as Money })).toMatchObject({
    base: 0,
    vat: 0,
    gross: 0,
    roundingAdjustment: 0,
  });
});

test("the result is frozen like a line snapshot", () => {
  expect(Object.isFrozen(amount())).toBe(true);
});

test("invalid input is rejected instead of rounded or coerced", () => {
  const bad: [string, Partial<Parameters<typeof snapshotAmount>[0]>][] = [
    ["negative gross", { gross: -1 as Money }],
    ["fractional gross", { gross: 100.5 as Money }],
    ["NaN gross", { gross: Number.NaN as Money }],
    ["unsafe gross", { gross: (Number.MAX_SAFE_INTEGER + 2) as Money }],
    ["negative unit price", { unitPrice: -1 as Money }],
    ["fractional unit price", { unitPrice: 1.5 as Money }],
    ["NaN unit price", { unitPrice: Number.NaN as Money }],
    ["negative quantity", { quantityThousandths: -1 }],
    ["fractional quantity", { quantityThousandths: 1.5 }],
    ["exclusive mode", { priceMode: "exclusive" as never }],
    ["unknown tax class", { taxClass: "luxury" as never }],
    ["impossible date", { on: "2026-02-30" }],
    ["rule not yet effective", { on: "2025-12-31" }],
  ];
  expect(amount()).toMatchObject({ gross: 10_005 });
  for (const [name, over] of bad) expect(() => amount(over), name).toThrow();
});
