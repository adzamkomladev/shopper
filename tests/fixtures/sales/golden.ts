export const ids = {
  org: "019a0000-0000-7000-8000-000000000001",
  otherOrg: "019a0000-0000-7000-8000-000000000002",
  device: "019a0000-0000-7000-8000-000000000003",
  branch: "019a0000-0000-7000-8000-000000000004",
  cashier: "019a0000-0000-7000-8000-000000000005",
  session: "019a0000-0000-7000-8000-000000000006",
  product: "019a0000-0000-7000-8000-000000000007",
  otherProduct: "019a0000-0000-7000-8000-000000000008",
  oldTax: "019a0000-0000-7000-8000-000000000009",
  currentTax: "019a0000-0000-7000-8000-00000000000a",
  basePrice: "019a0000-0000-7000-8000-00000000000b",
  branchPrice: "019a0000-0000-7000-8000-00000000000c",
  store: "019a0000-0000-7000-8000-00000000000d",
} as const;

export const foreignProduct = {
  id: ids.otherProduct,
  orgId: ids.otherOrg,
  sku: "OTHER-001",
  name: "Other tenant product",
  baseUnit: "each",
  taxClass: "standard",
  archivedAt: null,
};

export const references = {
  products: [
    {
      id: ids.product,
      orgId: ids.org,
      sku: "MILK-001",
      name: "Fresh milk",
      baseUnit: "each",
      taxClass: "standard",
      archivedAt: null,
    },
  ],
  prices: [
    {
      id: ids.basePrice,
      orgId: ids.org,
      productId: ids.product,
      branchId: null,
      amount: 10_000,
      validFrom: "2025-01-01T00:00:00.000Z",
      validTo: null,
    },
    {
      id: ids.branchPrice,
      orgId: ids.org,
      productId: ids.product,
      branchId: ids.branch,
      amount: 12_000,
      validFrom: "2025-06-01T00:00:00.000Z",
      validTo: null,
    },
  ],
  taxRules: [
    {
      id: ids.oldTax,
      orgId: ids.org,
      effectiveFrom: "2025-01-01",
      vatBps: 1_500,
      nhilBps: 250,
      getfundBps: 250,
      covidBps: 0,
      source: "golden fixture: prior rates",
    },
    {
      id: ids.currentTax,
      orgId: ids.org,
      effectiveFrom: "2026-01-01",
      vatBps: 1_000,
      nhilBps: 0,
      getfundBps: 0,
      covidBps: 0,
      source: "golden fixture: current rates",
    },
  ],
};

export const goldenSale = {
  on: "2025-12-31",
  quantityThousandths: 1_500,
  unitPrice: 12_000,
  line: {
    base: 15_000,
    vat: 2_250,
    nhil: 375,
    getfund: 375,
    covid: 0,
    gross: 18_000,
    roundingAdjustment: 0,
  },
  totals: {
    base: 15_000,
    vat: 2_250,
    nhil: 375,
    getfund: 375,
    covid: 0,
    gross: 18_000,
    roundingAdjustment: 0,
  },
};
