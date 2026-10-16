import { ghana2026 } from "@shopper/tax";
import { ids } from "../golden";

const identity = (suffix: number) =>
  `019a0000-0000-7000-8000-${suffix.toString(16).padStart(12, "0")}`;
export const products = {
  standard: {
    id: identity(100),
    name: "Rice",
    amount: 120_000,
    taxClass: "standard",
    baseUnit: "each",
  },
  zero: {
    id: identity(101),
    name: "Zero rated staple",
    amount: 30_000,
    taxClass: "zero-rated",
    baseUnit: "each",
  },
  exempt: {
    id: identity(102),
    name: "Exempt staple",
    amount: 50_000,
    taxClass: "exempt",
    baseUnit: "each",
  },
  weighed: {
    id: identity(103),
    name: "Tomatoes",
    amount: 360_000,
    taxClass: "standard",
    baseUnit: "kg",
  },
  labelled: {
    id: identity(104),
    name: "Labelled produce",
    amount: 30_000,
    taxClass: "standard",
    baseUnit: "kg",
  },
  up: {
    id: identity(105),
    name: "Rounding up item",
    amount: 12_500,
    taxClass: "standard",
    baseUnit: "each",
  },
  down: {
    id: identity(106),
    name: "Rounding down item",
    amount: 12_400,
    taxClass: "standard",
    baseUnit: "each",
  },
} as const;
export const goldenReferences = {
  cashRounding: "10p" as const,
  products: Object.entries(products).map(([key, p]) => ({
    id: p.id,
    orgId: ids.org,
    sku: `GOLDEN-${key}`,
    name: p.name,
    baseUnit: p.baseUnit,
    taxClass: p.taxClass,
    archivedAt: null,
    barcodes:
      key === "weighed"
        ? [{ code: "00001", quantityThousandths: 1000 }]
        : key === "labelled"
          ? [{ code: "00002", quantityThousandths: 1000 }]
          : [],
  })),
  prices: Object.values(products).map((p, i) => ({
    id: identity(200 + i),
    orgId: ids.org,
    productId: p.id,
    branchId: ids.branch,
    amount: p.amount,
    validFrom: "2026-01-01T00:00:00.000Z",
    validTo: null,
  })),
  taxRules: [
    { ...ghana2026, id: identity(300), orgId: ids.org, source: "Day 11 golden 2026 rates" },
  ],
  barcodeMappings: [
    {
      id: identity(400),
      prefix: 21,
      product: { start: 2, length: 5 },
      value: { start: 7, length: 5 },
      kind: "weight" as const,
      unit: "g" as const,
      decimals: 0,
    },
    {
      id: identity(401),
      prefix: 22,
      product: { start: 2, length: 5 },
      value: { start: 7, length: 5 },
      kind: "price" as const,
      decimals: 2,
    },
  ],
};
